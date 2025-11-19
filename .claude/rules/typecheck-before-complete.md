---
alwaysApply: true
description: ALWAYS run typecheck after TypeScript changes - 0 errors required
globs:
  - "*.ts"
  - "*.tsx"
---

# TypeCheck Before Complete

**CRITICAL RULE: TypeScript tasks are NOT complete until typecheck passes with 0 errors**

## The Mandatory Command

After ANY TypeScript changes, you MUST run:

```bash
bun run typecheck
```

**Required result**: `0 errors, 0 warnings`

If there are ANY errors, the task is NOT complete. Period.

## When This Rule Applies

This rule applies when you:

- Create new `.ts` or `.tsx` files
- Edit existing TypeScript files
- Change type definitions or interfaces
- Modify component props or ref types
- Update function signatures
- Change imports/exports
- Refactor TypeScript code
- Add new dependencies that affect types

**If you touched TypeScript, you MUST run typecheck.**

## The Workflow

1. Make TypeScript changes
2. **STOP** - Do not consider the task complete
3. Run `bun run typecheck`
4. If errors exist:
   - Read the error messages carefully
   - Fix each error
   - Run typecheck again
   - Repeat until 0 errors
5. Only after 0 errors: Task is complete

## Common TypeScript Errors to Check

### 1. Import/Export Type Mismatches

```typescript
// ❌ WRONG - Named import on default export
import { ComponentName } from "./Component";

// ✅ CORRECT - Check the export type first
import ComponentName from "./Component"; // For: export default Component
import { ComponentName } from "./Component"; // For: export const Component
```

**Always verify**: Does the file use `export default` or named exports?

### 2. Union Ref Types Passed to Specific Functions

```typescript
// ❌ WRONG - Union type cannot be passed to specific function
const ref = useRef<TypeA | TypeB>(null);
ref.current?.specificMethod(); // TypeScript error!

// ✅ CORRECT - Use conditional logic to narrow types
const refA = useRef<TypeA>(null);
const refB = useRef<TypeB>(null);

if (mode === "a" && refA.current) {
  refA.current.specificMethod();
}
```

**Always verify**: Are you passing union types to functions expecting specific types?

### 3. Type Definition Synchronization

```typescript
// ❌ WRONG - Different type definitions in different files
// File A:
type AnimationName = string;
// File B:
type AnimationName = "tpose" | "walking" | "running";

// ✅ CORRECT - Same type definition everywhere
// Both files:
type AnimationName = "tpose" | "walking" | "running";
```

**Always verify**: Are shared types consistent across all files?

### 4. Conditional Rendering Type Safety

```typescript
// ❌ WRONG - Ref type doesn't match component mode
<Component ref={genericRef} mode={specificMode} />

// ✅ CORRECT - Each mode gets its own typed ref
{mode === 'armor' && <Component ref={armorRef} mode="armor" />}
{mode === 'weapon' && <Component ref={weaponRef} mode="weapon" />}
```

**Always verify**: Do conditional rendering paths have correct types?

## Pre-Completion Checklist

Before considering a TypeScript task complete:

- [ ] Ran `bun run typecheck` from the package directory
- [ ] Result shows `0 errors, 0 warnings`
- [ ] Verified import/export types match (default vs named)
- [ ] Checked union types are not passed to specific functions
- [ ] Confirmed type definitions are synchronized across files
- [ ] Tested all conditional rendering paths have correct types
- [ ] No `any` or `unknown` types introduced
- [ ] All refs are properly typed with their specific types

**If ANY checkbox is unchecked, the task is NOT complete.**

## Why This Rule Exists

### Real Example: Commit c7017ea

This commit introduced TypeScript errors because typecheck was not run:

1. Used wrong import type (named import on default export)
2. Passed union ref types to mode-specific functions
3. Animation types mismatched between store and component
4. All caught by `bun run typecheck` - but it wasn't run

**Impact**: Code that looks correct but has type errors that will cause runtime issues.

**Prevention**: Run typecheck. Fix errors. Run again. Repeat until 0 errors.

## How to Fix TypeScript Errors

1. **Read the error message** - TypeScript error messages are helpful
2. **Identify the root cause** - Don't just satisfy the type checker, fix the issue
3. **Check related files** - Errors often span multiple files
4. **Use strict mode** - It catches subtle issues
5. **Test the fix** - Run typecheck again to verify

## Examples of Proper Usage

### ✅ Good: Running Typecheck

```
User: "Update the component props"
Claude: "I've updated the props. Running typecheck now..."
[Runs: bun run typecheck]
Claude: "Typecheck passed with 0 errors. Task complete."
```

### ❌ Bad: Skipping Typecheck

```
User: "Update the component props"
Claude: "I've updated the props. Task complete."
[Does not run typecheck - errors left unfixed]
```

## Integration with Other Rules

This rule works with:

- **research-first-protocol.md** - Research types before using them
- **coding-standards.md** - Enforce TypeScript strict typing
- **testing-standards.md** - Type safety enables better testing

## Enforcement

This rule is **NON-NEGOTIABLE**. If you:

- Complete a TypeScript task without running typecheck
- Ignore TypeScript errors
- Use workarounds to silence type errors (casting to any)

**You have violated this rule and must fix it.**

## Remember

- TypeScript errors are bugs, not warnings
- Run typecheck after every TypeScript change
- 0 errors required - no exceptions
- Type safety prevents runtime errors
- Catching errors early saves time

**Always run typecheck. Always fix errors. Always verify 0 errors. No exceptions.**

## Quick Reference

```bash
# From package directory
cd apps/core
bun run typecheck

# Expected output:
# ✓ TypeScript check passed (0 errors, 0 warnings)
```

**If you see errors, fix them. Run again. Repeat until clean.**
