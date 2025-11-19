# Claude Code Hooks System

This directory contains hooks that customize Claude Code's behavior during various lifecycle events. All hooks are implemented as TypeScript scripts executed by Bun.

## 📋 Hook Types Configured

### 1. **SessionStart**

**Triggers**: When a new conversation session begins
**Script**: `scripts/session-start.ts`
**Purpose**: Initialize session, log start time, display working directory

**Output Example**:

```
📍 Session started at 2024-11-07T22:15:30.000Z
💼 Working directory: ${WORKSPACE_DIR}/packages/asset-forge
🎯 Project: asset-forge
```

---

### 2. **UserPromptSubmit**

**Triggers**: When user submits a prompt
**Script**: `scripts/user-prompt-submit.ts`
**Purpose**: Scan for accidentally pasted secrets/API keys

**Detects**:

- AWS Access Keys (`AKIA...`)
- Google API Keys (`AIza...`)
- OpenAI API Keys (`sk-...`)
- GitHub Personal Access Tokens (`ghp_...`)
- Slack Tokens (`xox...`)

**Action**: Warns user and blocks if secrets detected

---

### 3. **PreToolUse - Bash**

**Triggers**: Before any Bash command execution
**Script**: `scripts/pre-tool-bash.ts`
**Purpose**: Prevent destructive commands

**Blocks**:

- `rm -rf /` or `rm -rf *`
- Writing to disk devices (`/dev/sd*`)
- Disk operations (`dd`, `mkfs`, `fdisk`)
- Force git operations (`git push --force`, `git reset --hard`)

**Exit Code 2**: Blocks execution completely

---

### 4. **PreToolUse - Write**

**Triggers**: Before writing files with Write tool
**Script**: `scripts/pre-tool-write.ts`
**Purpose**: Warn about sensitive file writes

**Warns for**:

- `.env` files
- Credential files (`credentials.json`, `serviceAccount.json`)
- Private keys (`.pem`, `.key`, `.p12`)
- SSH keys (`id_rsa`, `id_ed25519`)

**Exit Code 1**: Warns but allows operation

---

### 5. **PreToolUse - Edit**

**Triggers**: Before editing files with Edit tool
**Script**: `scripts/pre-tool-edit.ts`
**Purpose**: Warn about protected file edits

**Warns for**:

- `package.json`
- `package-lock.json`
- `bun.lockb`
- `yarn.lock`

**Exit Code 1**: Warns but allows operation

---

### 6. **PostToolUse - Write**

**Triggers**: After writing files
**Script**: `scripts/post-tool-write.ts`
**Purpose**: Auto-format code files

**Formats**:

- `.ts`, `.tsx`, `.js`, `.jsx`
- `.json`
- `.md`

**Uses**: Prettier (via `bunx prettier --write`)

---

### 7. **PostToolUse - Edit**

**Triggers**: After editing files
**Script**: `scripts/post-tool-edit.ts`
**Purpose**: Auto-format edited code

**Same behavior as PostToolUse - Write**

---

### 8. **PreCompact**

**Triggers**: Before conversation compaction
**Script**: `scripts/pre-compact.ts`
**Purpose**: Save conversation state

**Saves to**: `.claude/logs/compact-{timestamp}.json`

---

### 9. **Stop**

**Triggers**: When main agent task completes
**Script**: `scripts/stop.ts`
**Purpose**: Log task completion

**Appends to**: `.claude/logs/task-log.jsonl`

---

### 10. **SubagentStop**

**Triggers**: When subagent task completes
**Script**: `scripts/subagent-stop.ts`
**Purpose**: Log subagent completion

**Appends to**: `.claude/logs/subagent-log.jsonl`

---

### 11. **SessionEnd**

**Triggers**: When session terminates
**Script**: `scripts/session-end.ts`
**Purpose**: Final cleanup and session summary

**Saves to**: `.claude/logs/session-{timestamp}.json`

---

## 🔧 Hook Configuration

Hooks are configured in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/scripts/pre-tool-bash.ts",
            "timeout": 3000
          }
        ]
      }
    ]
  }
}
```

### Hook Structure

- **matcher**: Filter by tool name (e.g., `"Bash"`, `"Write"`, `"Edit"`)
- **type**: Must be `"command"`
- **command**: Path to executable script (use `$CLAUDE_PROJECT_DIR` for portable paths)
- **timeout**: Maximum execution time in milliseconds

### Important: Path Resolution

**Always use `$CLAUDE_PROJECT_DIR`** in hook commands to ensure proper path resolution:

✅ **Correct:**

```json
"command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/scripts/my-hook.ts"
```

❌ **Incorrect (will fail):**

```json
"command": "bun .claude/hooks/scripts/my-hook.ts"
```

The `$CLAUDE_PROJECT_DIR` environment variable ensures hooks work regardless of the current working directory when they execute. Without it, you may see errors like "Module not found".

---

## 📊 Hook Input/Output

### Input (via stdin)

Hooks receive JSON with hook-specific data:

```typescript
interface HookInput {
  hook_event_name: string;
  current_working_directory: string;
  // Tool-specific fields:
  tool_name?: string;
  tool_input?: any;
  tool_output?: string;
  user_prompt?: string;
}
```

### Output (via stdout)

Hooks can output structured JSON:

```typescript
{
  "systemMessage": "Message shown to user/Claude",
  "additionalContext": "Injected into conversation (UserPromptSubmit only)"
}
```

### Exit Codes

| Code  | Meaning    | Behavior                                    |
| ----- | ---------- | ------------------------------------------- |
| **0** | Success    | Execution continues                         |
| **1** | User Error | Show stderr to user, continue               |
| **2** | Block      | Show stderr to Claude, block tool execution |

---

## 🛡️ Security Features

### Secret Detection

- Scans prompts for API keys/tokens
- Prevents accidental secret exposure
- Regex-based pattern matching

### File Protection

- Warns on sensitive file writes
- Prevents .env file commits
- Protects lock files from accidental edits

### Command Validation

- Blocks destructive shell commands
- Prevents force push to git
- Validates disk operations

### Auto-Formatting

- Runs Prettier after file writes/edits
- Maintains code style consistency
- Non-blocking (failures don't stop execution)

---

## 📁 Directory Structure

```
.claude/hooks/
├── README.md                        # This file
├── scripts/                         # Hook implementations
│   ├── session-start.ts            # SessionStart hook
│   ├── user-prompt-submit.ts       # UserPromptSubmit hook
│   ├── pre-tool-bash.ts            # PreToolUse Bash hook
│   ├── pre-tool-write.ts           # PreToolUse Write hook
│   ├── pre-tool-edit.ts            # PreToolUse Edit hook
│   ├── post-tool-write.ts          # PostToolUse Write hook
│   ├── post-tool-edit.ts           # PostToolUse Edit hook
│   ├── pre-compact.ts              # PreCompact hook
│   ├── stop.ts                     # Stop hook
│   ├── subagent-stop.ts            # SubagentStop hook
│   └── session-end.ts              # SessionEnd hook
└── [legacy JSON hooks]             # Old format (deprecated)
```

---

## 🔄 Lifecycle Flow

```
Session Start
    ↓
[SessionStart Hook] → Log session info
    ↓
User submits prompt
    ↓
[UserPromptSubmit Hook] → Validate prompt
    ↓
Claude plans tool use
    ↓
[PreToolUse Hook] → Validate command/file
    ↓
Tool executes
    ↓
[PostToolUse Hook] → Auto-format files
    ↓
Task completes
    ↓
[Stop Hook] → Log completion
    ↓
Session ends
    ↓
[SessionEnd Hook] → Final cleanup
```

---

## 🚀 Adding Custom Hooks

### 1. Create Hook Script

```typescript
#!/usr/bin/env bun
import { readFileSync } from "fs";

interface HookInput {
  hook_event_name: string;
  current_working_directory: string;
  // Add tool-specific fields
}

function main() {
  try {
    const input: HookInput = JSON.parse(readFileSync(0, "utf-8"));

    // Your hook logic here

    const output = {
      systemMessage: "Your message here",
      additionalContext: null,
    };

    console.log(JSON.stringify(output));
    process.exit(0);
  } catch (error) {
    console.error(`Hook error: ${error}`);
    process.exit(1);
  }
}

main();
```

### 2. Make Executable

```bash
chmod +x .claude/hooks/scripts/my-hook.ts
```

### 3. Add to settings.json

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "MyTool",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/scripts/my-hook.ts",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

---

## 📝 Logs

Hooks create log files in `.claude/logs/`:

- `task-log.jsonl` - Task completion events
- `subagent-log.jsonl` - Subagent completion events
- `compact-*.json` - Pre-compaction snapshots
- `session-*.json` - Session end summaries

**Note**: Logs are `.gitignore`d and won't be committed

---

## ⚙️ Configuration

### Disable All Hooks

Add to `.claude/settings.json`:

```json
{
  "disableAllHooks": true
}
```

### Disable Specific Hook

Remove or comment out from `settings.json`:

```json
{
  "hooks": {
    // "PreToolUse": [...],  // Commented out
  }
}
```

### Adjust Timeouts

```json
{
  "type": "command",
  "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/scripts/my-hook.ts",
  "timeout": 10000 // 10 seconds
}
```

---

## 🧪 Testing Hooks

### Test Individual Hook

```bash
echo '{"hook_event_name":"PreToolUse","current_working_directory":"/path","tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | bun .claude/hooks/scripts/pre-tool-bash.ts
```

### Expected Exit Codes

- **0**: Success (no output)
- **1**: Warning (outputs to stdout/stderr)
- **2**: Blocked (outputs error to stderr)

---

## 🔗 References

- [Claude Code Hooks Documentation](https://code.claude.com/docs/en/hooks-guide)
- [Hooks System (DeepWiki)](https://deepwiki.com/anthropics/claude-code#3.4)

---

**Version**: 1.0.0
**Last Updated**: November 7, 2024
**Runtime**: Bun
**Language**: TypeScript

---

## Research-First Protocol

The hooks system now enforces a **research-first protocol** to ensure Claude Code always researches before writing or editing code.

### How It Works

The system tracks tool usage across a session using `.claude/logs/tool-usage.jsonl`. This log records:

- Read tool usage (which files were read)
- Grep searches (what patterns were searched)
- Glob searches (what file patterns were queried)
- Write and Edit operations

### Warnings Triggered

#### PreToolUse - Write

Warns if:

1. **Creating new file without research**
   - No prior Glob/Grep searches in parent directory
   - File hasn't been read yet
2. **Using external libraries without deepwiki**
   - Detects imports like `@privy-io`, `drizzle-orm`, `elysia`, etc.
   - No deepwiki usage in past 5 minutes

#### PreToolUse - Edit

Warns if:

1. **Editing file without reading it first**
   - File hasn't been read in past 30 minutes
2. **Adding external libraries without deepwiki**
   - Same library detection as Write hook
   - No deepwiki usage in past 5 minutes

### Example Warnings

```
⚠️  WARNING: Creating new file without research
File: new-component.tsx

Did you:
- Search for existing similar files with Glob?
- Search for related code with Grep?
- Ask user for verification?

Research-first protocol: Always research before creating files.
```

```
⚠️  WARNING: Using external libraries without research
Libraries detected: @privy-io, drizzle-orm

Did you:
- Use deepwiki to research library APIs?
- Check library documentation?
- Verify current best practices?

Research-first protocol: Always research libraries before using them.
```

### Tracked Libraries

The system tracks usage of these external libraries:

- `@privy-io` - Authentication
- `@react-three`, `three` - 3D graphics
- `drizzle-orm` - Database ORM
- `elysia`, `@elysiajs` - API framework
- `playwright` - E2E testing
- `vitest` - Unit testing
- `zod`, `@typebox` - Schema validation

### Tool Usage Log

Located at `.claude/logs/tool-usage.jsonl`, this file contains timestamped entries:

```json
{"timestamp":"2025-11-08T10:30:00.000Z","tool":"Read","path":"/path/to/file.ts"}
{"timestamp":"2025-11-08T10:31:00.000Z","tool":"Glob","path":"/path","query":"**/*.ts"}
{"timestamp":"2025-11-08T10:32:00.000Z","tool":"Write","path":"/path/to/new-file.ts"}
```

This log is automatically cleaned up on SessionEnd and is gitignored.

### Bypassing Warnings

All warnings use exit code 1, which **warns but allows** the operation to proceed. If you receive a warning:

1. Consider if research is truly needed
2. If yes, perform the research (Read/Grep/Glob/deepwiki)
3. If no, you can proceed - the warning is just a reminder

### Time Windows

- **File read tracking**: 30 minutes (files read recently don't trigger warnings)
- **Deepwiki tracking**: 5 minutes (recent deepwiki usage exempts library warnings)
- **Log retention**: Cleared on SessionEnd
