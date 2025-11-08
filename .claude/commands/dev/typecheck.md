---
description: Run TypeScript type checking
allowed-tools: [Bash]
argument-hint: [--watch]
---

# TypeScript Type Check

Run TypeScript compiler to verify type safety. **ZERO `any` types policy** enforced.

## Standard Check

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== TypeScript Type Check ===" && bun run typecheck 2>&1 && echo -e "\n✅ No type errors" || (echo -e "\n❌ Type errors found - run /fix-types to resolve" && exit 1)`
```

## Watch Mode

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== TypeScript Watch Mode ===" && echo "Watching... (Press Ctrl+C to stop)" && bun tsc --noEmit --watch`
```

## Strict Mode Rules

Per CLAUDE.md coding standards:
- **NO** implicit `any` types
- **NO** `unknown` without narrowing
- Strict null checks enabled
- No unused locals
- Exact optional property types
- All public functions must have return types

All type errors must be fixed before deployment.
