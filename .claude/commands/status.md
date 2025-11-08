---
description: Comprehensive git status with recent changes and branch info
allowed-tools: [Bash]
---

# Git Status Overview

Get a complete picture of the current repository state with context, recent commits, and change statistics.

## Full Status Report

```bash
!`cd /Users/home/hyperscape-5 && echo "=== Git Repository Status ===" && echo && echo "📍 Current Branch:" && git branch --show-current && echo && echo "📊 Branch Status:" && git status -sb && echo && echo "📝 Recent Commits (last 5):" && git log --oneline --graph --decorate --color=always -5 && echo && echo "📄 Unstaged Changes:" && (git diff --stat --color=always || echo "None") && echo && echo "✓ Staged Changes:" && (git diff --staged --stat --color=always || echo "None") && echo && echo "❓ Untracked Files (showing first 10):" && (git ls-files --others --exclude-standard | head -10 || echo "None") && echo && echo "✎ Modified Files:" && (git ls-files -m | head -10 || echo "None")`
```

## Branch Information

```bash
!`cd /Users/home/hyperscape-5 && git branch -vv && echo && echo "Remote tracking:" && git remote -v`
```

## Recent Activity

```bash
!`cd /Users/home/hyperscape-5 && echo "=== Recent Activity ===" && git log --oneline --graph --all --decorate -10`
```

## Detailed Diff Stats

```bash
!`cd /Users/home/hyperscape-5 && echo "=== Detailed Change Statistics ===" && echo && echo "Unstaged changes:" && git diff --stat --color && echo && echo "Staged changes:" && git diff --staged --stat --color`
```

## Quick Status (Short Form)

```bash
!`cd /Users/home/hyperscape-5 && git status -s`
```

## Use Cases

Use this command:
- **Before starting work** - Understand current state
- **Before committing** - Review what will be committed
- **After pulling** - See what changed
- **Before creating PR** - Verify all changes intended

## Understanding Output

### Status Indicators

- `??` - Untracked files
- `M ` - Modified and staged
- ` M` - Modified but not staged
- `MM` - Modified, staged, then modified again
- `A ` - Added (new file staged)
- `D ` - Deleted
- `R ` - Renamed
- `!!` - Ignored files

### Branch Status

- `ahead N` - Your branch has N commits not pushed
- `behind N` - Remote has N commits you don't have
- `diverged` - Both local and remote have unique commits

## Common Next Steps

After reviewing status:
- `/git/commit` - Commit current changes
- `/lint` - Check code quality
- `/test` - Run test suite
- `/check-types` - Verify TypeScript types

## See Also

- `/git/commit` - Guided commit workflow
- `/git/review` - Pre-commit review checklist
- @.gitignore - Ignored file patterns
