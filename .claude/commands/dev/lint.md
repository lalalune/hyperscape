---
description: Run ESLint on asset-forge codebase
allowed-tools: [Bash]
argument-hint: [--fix]
---

# Lint Code

Run ESLint to check code quality, style, and best practices.

## Check Only (No Changes)

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== ESLint Code Quality Check ===" && bun run lint 2>&1 && echo -e "\n✅ No lint errors" || (echo -e "\n❌ Lint errors found" && echo "Auto-fix with: /dev/lint --fix" && exit 1)`
```

## Auto-Fix Issues

Automatically fix fixable lint errors:

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== ESLint Auto-Fix ===" && bun run lint -- --fix 2>&1 && echo -e "\n✅ Linting complete - check git diff for changes" || (echo -e "\n❌ Some errors require manual fixes" && exit 1)`
```

## Rules Enforced

ESLint enforces these rules:

### TypeScript
- Strict typing (no `any`)
- Explicit return types
- Proper type imports (`import type`)
- No unused variables

### React
- Hooks dependency arrays
- Proper key props in lists
- No dangerous HTML
- Component naming conventions

### Code Quality
- Import organization
- Consistent spacing
- Proper error handling
- No console.log in production

### Best Practices
- Avoid nested ternaries
- Max function complexity
- Prefer const over let
- Destructuring patterns

## Common Fixes

```bash
# Fix import ordering
!`cd /Users/home/hyperscape-5/packages/asset-forge && bun run lint -- --fix --rule 'import/order'`

# Fix React hooks
!`cd /Users/home/hyperscape-5/packages/asset-forge && bun run lint -- --fix --rule 'react-hooks/exhaustive-deps'`
```

## Integration

Linting runs automatically:
- **Pre-commit**: Via git hooks
- **CI/CD**: In deployment pipeline
- **IDE**: Real-time feedback

**Fix all linting errors before committing code.**

## See Also

- `/dev/format` - Format code with Prettier
- `/check-types` - TypeScript type checking
- `/git/review` - Pre-commit code review
