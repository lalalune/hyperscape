---
description: Validate TypeScript strong typing rules
allowed-tools:
  - Grep(packages/plugin-hyperscape/src/**)
  - Read(packages/plugin-hyperscape/src/**/*.ts)
  - Bash(grep *)
  - Bash(cd packages/plugin-hyperscape*)
argument-hint: "[path] - Optional: specific file or directory to check"
model: sonnet
---

Check for type violations in the codebase

Rules enforced:
- ❌ No `any` types
- ❌ No `unknown` types
- ✅ Explicit return types on public methods
- ❌ No property existence checks on polymorphic objects
- ❌ No `as any` casts

Scans: packages/plugin-hyperscape/src/**/*.ts

Commands:
```bash
# Check for 'any' types
grep -rn ": any\b" packages/plugin-hyperscape/src --include="*.ts"

# Check for 'unknown' types
grep -rn ": unknown\b" packages/plugin-hyperscape/src --include="*.ts"

# Check for 'as any' casts
grep -rn "as any" packages/plugin-hyperscape/src --include="*.ts"
```

See CLAUDE.md for full strong typing guidelines.
