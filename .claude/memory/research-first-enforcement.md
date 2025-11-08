# Research-First Enforcement System

**Status**: ACTIVE
**Date Implemented**: 2025-11-08

## Philosophy

**DEEPWIKI FIRST. ALWAYS. NO EXCEPTIONS.**

I don't know anything current. My knowledge is outdated (cutoff January 2025). I am worthless without deepwiki.

Code writing is the LAST priority. Before any code is written, we must:

1. **USE DEEPWIKI MANDATORY** - For ANY external library, framework, API, package
   - Claude's knowledge is outdated and WRONG
   - Never assume I know the API
   - If repo not found on deepwiki: Search GitHub first, get owner/repo, then deepwiki again
   - This is NOT optional - this is REQUIRED
2. Gather context by reading existing files
3. Triple-check for existing code to reuse
4. Ask user for verification on any assumptions
5. Keep solutions simple - no over-engineering
6. Only then write code

**DEEPWIKI IS NOT A "NICE TO HAVE" - IT IS MANDATORY FOR ALL EXTERNAL DEPENDENCIES**

## Implementation Across System

### 1. All Agents Enforce It

**Files**: `.claude/agents/*.md` (5 agents)

- api-specialist.md
- database-specialist.md
- frontend-specialist.md
- testing-specialist.md
- security-specialist.md

Each has "Research-First Protocol" section with:

- 6-step workflow
- Pre-code checklist
- Key principles (Reuse > Create, Simple > Complex, Ask > Assume, Research > Memory)

### 2. Hooks Enforce It

**Pre-tool hooks** (warn before violations):

- `pre-tool-write.ts` - Warns if creating files without Glob/Grep research
- `pre-tool-edit.ts` - Warns if editing files not recently read (30-min window)

**Post-tool hooks** (track research):

- `post-tool-read.ts` - Logs all file reads with timestamps
- `post-tool-grep.ts` - Logs all searches
- `post-tool-glob.ts` - Logs all pattern matches

**Session tracking**: `.claude/logs/tool-usage.jsonl` tracks all research activity

**Tracked external libraries** (warns if used without deepwiki):

- @privy-io, drizzle-orm, elysia, @elysiajs
- @react-three/fiber, @react-three/drei, three
- playwright, vitest, zod, @typebox/value

### 3. Memory Enforces It

**File**: `.claude/memory/coding-standards.md`

Research-First Protocol is the #1 rule (top of file, marked MOST IMPORTANT)

### 4. Rules Enforce It

**File**: `.claude/rules/research-first-protocol.md`

Comprehensive rule with:

- alwaysApply: true
- Mandatory workflow steps
- Pre-code checklist
- Examples of violations vs good practices

### 5. Configuration Files

**settings.json**: All hooks configured
**gitignore**: .claude/logs/ excluded from git

## How It Works

When code is about to be written:

1. Pre-tool hook checks if research happened (Read/Grep/Glob in past 30 min)
2. Pre-tool hook checks if deepwiki used for external libraries (past 5 min)
3. If missing, **warns but allows** (exit code 1)
4. All activity logged to session file

## Example Warning

```
⚠️  WARNING: Creating new file without research
File: NewComponent.tsx

Did you:
- Search for existing similar files with Glob?
- Search for related code with Grep?
- Ask user for verification?

Research-first protocol: Always research before creating files.
```

## Key Tracking Windows

- **File reads**: 30 minutes
- **Deepwiki research**: 5 minutes
- **Glob/Grep searches**: Tracked indefinitely per session

## Specialized Agent

**config-specialist.md** - Created for meta-configuration work

- Updates agents, rules, hooks, memory
- Enforces development philosophies system-wide
- Use this agent (not others) for .claude configuration tasks

## Benefits

1. **Prevents duplication** - Forces search before creation
2. **Ensures current info** - Deepwiki usage for external libraries
3. **Encourages simplicity** - Research existing solutions first
4. **Reduces assumptions** - Ask user before guessing
5. **Maintains consistency** - Reuse patterns already in codebase

## Remember

- Code is a liability, not an asset
- Less code is better
- Reuse > Create
- Simple > Complex
- Ask > Assume
- Research > Memory
- Deepwiki > Claude's outdated knowledge

**Research first. Code last. Always.**
