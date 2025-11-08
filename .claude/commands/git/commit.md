---
description: Guided git commit workflow with validation
allowed-tools: [Bash, Read, Grep]
argument-hint: [message]
---

# Git Commit Workflow

Guided workflow for creating well-formed git commits with validation.

## Quick Commit with Message

If you provide a message argument, commit directly:

```bash
!`if [ -n "$ARGUMENTS" ]; then cd /Users/home/hyperscape-5 && echo "Pre-commit validation..." && cd packages/asset-forge && bun tsc --noEmit 2>&1 && cd /Users/home/hyperscape-5 && git add -A && git commit -m "$ARGUMENTS" && echo "✅ Committed: $ARGUMENTS"; else echo "Provide commit message: /git/commit <message>"; fi`
```

## Guided Commit Workflow

Full workflow with validation and review:

### Step 1: Pre-Commit Validation

```bash
!`cd /Users/home/hyperscape-5 && echo "=== Pre-Commit Validation ===" && echo && echo "[1/3] Type Check..." && cd packages/asset-forge && bun tsc --noEmit 2>&1 && echo "✅ Types OK" || echo "⚠️  Type errors - fix before committing" && echo && echo "[2/3] Lint Check..." && bun run lint 2>&1 && echo "✅ Lint OK" || echo "⚠️  Lint errors - fix before committing" && echo && echo "[3/3] Tests..." && bun test 2>&1 && echo "✅ Tests OK" || echo "⚠️  Tests failed"`
```

### Step 2: Review Changes

```bash
!`cd /Users/home/hyperscape-5 && echo "=== Changes to be Committed ===" && echo && git status && echo && echo "=== Diff Summary ===" && git diff --stat && echo && echo "=== Recent Commits (for reference) ===" && git log --oneline -5`
```

### Step 3: Stage All Changes

```bash
!`cd /Users/home/hyperscape-5 && git add -A && echo "✅ All changes staged" && git status -s`
```

### Step 4: Create Commit

```bash
!`cd /Users/home/hyperscape-5 && if [ -n "$ARGUMENTS" ]; then git commit -m "$ARGUMENTS" && echo "✅ Commit created"; else echo "ERROR: Provide commit message as argument"; fi`
```

## Commit Message Guidelines

Follow conventional commit format:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `docs:` - Documentation changes
- `test:` - Test changes
- `chore:` - Build/tooling changes
- `perf:` - Performance improvements
- `style:` - Code style changes

### Examples

```bash
# Feature
feat(teams): add team creation API endpoint

# Bug fix
fix(rigging): correct animation retargeting for VRM models

# Refactor
refactor(db): improve schema type safety with Drizzle

# Documentation
docs(api): add OpenAPI specs for teams endpoints

# Tests
test(services): add comprehensive TeamService tests
```

## Pre-Commit Checklist

Before committing, ensure:

- [ ] `/check-types` passes (zero type errors)
- [ ] `/test` passes (all tests green)
- [ ] `/lint` passes (no lint errors)
- [ ] Changes are intentional and reviewed
- [ ] Commit message is clear and descriptive
- [ ] No console.log or debugging code
- [ ] No commented-out code
- [ ] No TODOs without issues

## Amend Last Commit

If you need to modify the last commit:

```bash
!`cd /Users/home/hyperscape-5 && git add -A && git commit --amend --no-edit && echo "✅ Last commit amended"`
```

With new message:

```bash
!`cd /Users/home/hyperscape-5 && git add -A && git commit --amend -m "$ARGUMENTS" && echo "✅ Commit amended with new message"`
```

## Undo Last Commit (Keep Changes)

```bash
!`cd /Users/home/hyperscape-5 && git reset --soft HEAD~1 && echo "✅ Last commit undone - changes still staged"`
```

## Sign Commit with GPG

```bash
!`cd /Users/home/hyperscape-5 && git commit -S -m "$ARGUMENTS" && echo "✅ Signed commit created"`
```

## Common Workflows

### Quick Fix Commit

```bash
!`cd /Users/home/hyperscape-5 && git add -A && git commit -m "fix: $ARGUMENTS" && echo "✅ Fix committed"`
```

### Feature Commit with Validation

```bash
!`cd /Users/home/hyperscape-5 && echo "Validating..." && cd packages/asset-forge && bun tsc --noEmit && bun test && cd /Users/home/hyperscape-5 && git add -A && git commit -m "feat: $ARGUMENTS" && echo "✅ Feature committed"`
```

## See Also

- `/status` - Check git status before committing
- `/git/review` - Pre-commit review checklist
- `/check-types` - Type validation
- `/test` - Run tests
- `/lint` - Code quality check
