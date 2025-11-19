# Research-First Protocol Implementation

## Overview

The Claude Code hooks system has been enhanced with a **research-first protocol** that enforces best practices by warning when files are created or edited without proper research.

## Files Modified

### 1. `${WORKSPACE_DIR}/.claude/hooks/scripts/pre-tool-write.ts`
Enhanced with research-first checks:
- Detects new file creation without prior research (Glob/Grep)
- Detects external library usage without deepwiki research
- Logs all Write operations to tool usage log
- Maintains existing sensitive file warnings

### 2. `${WORKSPACE_DIR}/.claude/hooks/scripts/pre-tool-edit.ts`
Enhanced with research-first checks:
- Warns when editing files that haven't been read (30-minute window)
- Detects external library additions without deepwiki research
- Logs all Edit operations to tool usage log
- Maintains existing protected file warnings

## Files Created

### 3. `${WORKSPACE_DIR}/.claude/hooks/scripts/post-tool-read.ts`
Tracks Read tool usage:
- Logs which files were read
- Timestamps for 30-minute tracking window
- Non-blocking (exit 0 on errors)

### 4. `${WORKSPACE_DIR}/.claude/hooks/scripts/post-tool-grep.ts`
Tracks Grep searches:
- Logs search patterns and paths
- Used to determine if research was performed
- Non-blocking

### 5. `${WORKSPACE_DIR}/.claude/hooks/scripts/post-tool-glob.ts`
Tracks Glob searches:
- Logs file pattern searches
- Used to verify file research before creation
- Non-blocking

## Configuration Changes

### 6. `${WORKSPACE_DIR}/.claude/settings.json`
Added PostToolUse hooks for Read, Grep, and Glob:
```json
{
  "PostToolUse": [
    {
      "matcher": "Read",
      "hooks": [{"type": "command", "command": "bun .claude/hooks/scripts/post-tool-read.ts", "timeout": 2000}]
    },
    {
      "matcher": "Grep",
      "hooks": [{"type": "command", "command": "bun .claude/hooks/scripts/post-tool-grep.ts", "timeout": 2000}]
    },
    {
      "matcher": "Glob",
      "hooks": [{"type": "command", "command": "bun .claude/hooks/scripts/post-tool-glob.ts", "timeout": 2000}]
    }
  ]
}
```

### 7. `${WORKSPACE_DIR}/.gitignore`
Added log directory to gitignore:
```
# Claude hooks logs
.claude/logs/
```

## How It Works

### Tool Usage Tracking

The system creates a session log at `.claude/logs/tool-usage.jsonl` that tracks:

```json
{"timestamp":"2025-11-08T10:30:00.000Z","tool":"Read","path":"/path/to/file.ts"}
{"timestamp":"2025-11-08T10:31:00.000Z","tool":"Glob","path":"/path","query":"**/*.ts"}
{"timestamp":"2025-11-08T10:32:00.000Z","tool":"Grep","path":"/path","query":"import.*Privy"}
{"timestamp":"2025-11-08T10:33:00.000Z","tool":"Write","path":"/path/to/new.ts"}
```

### Warning Triggers

#### Pre-Write Warnings

1. **New file without research**
   - Triggered: Creating a file that doesn't exist
   - Condition: No prior Glob/Grep searches in parent directory
   - Action: Warn (exit 1) but allow

2. **External libraries without deepwiki**
   - Triggered: Content contains external library imports
   - Condition: No deepwiki usage in past 5 minutes
   - Libraries tracked: @privy-io, drizzle-orm, elysia, three, etc.
   - Action: Warn (exit 1) but allow

#### Pre-Edit Warnings

1. **Editing without reading**
   - Triggered: Editing any file
   - Condition: File not read in past 30 minutes
   - Action: Warn (exit 1) but allow

2. **Adding libraries without deepwiki**
   - Triggered: new_string contains external library imports
   - Condition: No deepwiki usage in past 5 minutes
   - Action: Warn (exit 1) but allow

### Time Windows

- **File read expiration**: 30 minutes
  - After 30 minutes, you'll be warned to re-read the file
  
- **Deepwiki expiration**: 5 minutes
  - Recent deepwiki usage exempts you from library warnings
  
- **Log retention**: Until SessionEnd
  - Tool usage log is cleared when session ends

## Tracked External Libraries

The system recognizes these libraries and requires deepwiki research:

- `@privy-io` - Privy authentication
- `@react-three` - React Three Fiber
- `three` - Three.js
- `drizzle-orm` - Drizzle ORM
- `elysia`, `@elysiajs` - Elysia framework
- `playwright` - Playwright testing
- `vitest` - Vitest testing
- `zod` - Zod validation
- `@typebox` - TypeBox validation

## Example Warnings

### Creating File Without Research

```
⚠️  WARNING: Creating new file without research
File: components/NewComponent.tsx

Did you:
- Search for existing similar files with Glob?
- Search for related code with Grep?
- Ask user for verification?

Research-first protocol: Always research before creating files.
```

### Editing Without Reading

```
⚠️  WARNING: Editing file without reading it first
File: api-elysia.ts

Did you:
- Read the file with Read tool to understand context?
- Check surrounding code for patterns?
- Verify your changes won't break existing functionality?

Research-first protocol: Always read files before editing them.
```

### Using Libraries Without Research

```
⚠️  WARNING: Using external libraries without research
Libraries detected: @privy-io, drizzle-orm

Did you:
- Use deepwiki to research library APIs?
- Check library documentation?
- Verify current best practices?

Research-first protocol: Always research libraries before using them.
```

## Best Practices

### Before Creating a New File

1. **Search for existing patterns**
   ```
   Glob: **/*Component.tsx
   Grep: "export default function.*Component"
   ```

2. **Ask user for confirmation**
   - Verify the file path is correct
   - Confirm naming conventions

3. **Research libraries**
   - Use deepwiki for external library APIs
   - Check official documentation

### Before Editing a File

1. **Read the file first**
   ```
   Read: /path/to/file.ts
   ```

2. **Understand the context**
   - Check imports and dependencies
   - Review existing patterns
   - Look for related files

3. **Research new dependencies**
   - Use deepwiki for library-specific APIs
   - Verify compatibility with existing code

## Bypassing Warnings

All warnings use **exit code 1** (warn but allow). You can proceed after a warning if:

1. You've already done the research manually
2. The file/change is trivial
3. You're confident in the approach

The warnings are **reminders**, not blockers. They encourage good habits but don't prevent work.

## Testing

Test the hooks manually:

```bash
# Test pre-tool-write
echo '{"hook_event_name":"PreToolUse","current_working_directory":"/path","tool_name":"Write","tool_input":{"file_path":"/tmp/test.ts","content":"import { Privy } from '@privy-io/server-auth';"}}' | bun .claude/hooks/scripts/pre-tool-write.ts

# Test pre-tool-edit
echo '{"hook_event_name":"PreToolUse","current_working_directory":"/path","tool_name":"Edit","tool_input":{"file_path":"/tmp/test.ts","old_string":"old","new_string":"new"}}' | bun .claude/hooks/scripts/pre-tool-edit.ts
```

Expected: Exit code 1 with warning message

## Future Enhancements

Potential improvements:
- Track deepwiki MCP usage (currently not tracked)
- Add configurable time windows
- Whitelist certain files/directories
- Severity levels (info, warn, block)
- Session statistics dashboard

---

**Version**: 1.0.0  
**Created**: November 8, 2024  
**Runtime**: Bun  
**Language**: TypeScript
