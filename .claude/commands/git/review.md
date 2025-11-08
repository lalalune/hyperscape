---
description: Pre-commit code review checklist
allowed-tools: [Bash, Read, Grep]
---

# Pre-Commit Code Review

Comprehensive code review checklist before committing changes.

## Automated Checks

Run all automated quality checks:

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== AUTOMATED CODE REVIEW ===" && echo && echo "[1/5] TypeScript Type Check..." && bun tsc --noEmit 2>&1 && echo "✅ Types OK" || echo "❌ Type errors found" && echo && echo "[2/5] ESLint..." && bun run lint 2>&1 && echo "✅ Lint OK" || echo "❌ Lint errors found" && echo && echo "[3/5] Tests..." && bun test 2>&1 && echo "✅ Tests OK" || echo "❌ Tests failed" && echo && echo "[4/5] Build..." && bun run build 2>&1 && echo "✅ Build OK" || echo "❌ Build failed" && echo && echo "[5/5] Git Status..." && cd /Users/home/hyperscape-5 && git status -s`
```

## Manual Review Checklist

Review these items manually:

### Code Quality

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== CODE QUALITY REVIEW ===" && echo && echo "Checking for anti-patterns..." && echo && echo "1. Any types (FORBIDDEN):" && (grep -r ": any" src/ server/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | xargs -I {} echo "  Found {} instances") && echo && echo "2. Console.log statements:" && (grep -r "console\.log" src/ server/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | xargs -I {} echo "  Found {} instances") && echo && echo "3. TODO comments:" && (grep -r "TODO" src/ server/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | xargs -I {} echo "  Found {} instances") && echo && echo "4. Commented code:" && (grep -r "^[[:space:]]*//.*(" src/ server/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | xargs -I {} echo "  Found {} instances") && echo && echo "5. Debugger statements:" && (grep -r "debugger" src/ server/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | xargs -I {} echo "  Found {} instances")`
```

### Security Review

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== SECURITY REVIEW ===" && echo && echo "1. Hardcoded secrets:" && (grep -rE "(sk_|pk_|api_key|password|secret)" src/ server/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "process.env" | grep -v "// " | wc -l | xargs -I {} echo "  Found {} potential secrets") && echo && echo "2. Unsafe eval:" && (grep -r "eval(" src/ server/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | xargs -I {} echo "  Found {} eval statements") && echo && echo "3. SQL injection risks:" && (grep -r "query.*\$\{" src/ server/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | xargs -I {} echo "  Found {} template string queries")`
```

### Test Coverage

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== TEST COVERAGE REVIEW ===" && echo && echo "Test files:" && find . -name "*.test.ts" -o -name "*.test.tsx" | wc -l | xargs -I {} echo "  {} test files found" && echo && echo "Modified files needing tests:" && cd /Users/home/hyperscape-5 && git diff --name-only --cached | grep -E "\.(ts|tsx)$" | grep -v ".test.ts"`
```

### Git Changes

```bash
!`cd /Users/home/hyperscape-5 && echo "=== GIT CHANGES REVIEW ===" && echo && echo "Files changed:" && git diff --cached --stat && echo && echo "Lines changed:" && git diff --cached --numstat | awk '{added+=$1; removed+=$2} END {print "  +" added " -" removed}'`
```

## Review Checklist

Before committing, verify:

### Code Quality
- [ ] No `any` or `unknown` types
- [ ] All functions have explicit return types
- [ ] No `console.log` or debugging statements
- [ ] No commented-out code
- [ ] No TODO comments without GitHub issues
- [ ] Proper error handling everywhere

### Architecture
- [ ] Follows existing patterns and conventions
- [ ] No circular dependencies introduced
- [ ] Proper separation of concerns
- [ ] Code is in the right location/package
- [ ] Uses existing abstractions when possible

### Testing
- [ ] All new code has tests
- [ ] All tests pass
- [ ] Tests follow "no mocks" rule
- [ ] Visual tests for 3D components
- [ ] Error cases tested

### Security
- [ ] No hardcoded secrets or API keys
- [ ] No sensitive data logged
- [ ] Input validation implemented
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (proper escaping)

### Performance
- [ ] No unnecessary re-renders (React)
- [ ] Efficient database queries
- [ ] Large files handled properly
- [ ] Images optimized
- [ ] Bundle size impact acceptable

### Documentation
- [ ] Complex logic is commented
- [ ] API endpoints documented
- [ ] README updated if needed
- [ ] Type definitions are clear
- [ ] Examples provided for new features

## Common Issues to Check

### TypeScript Issues

```typescript
// ❌ Bad
function getData(): any {
  return fetch('/api');
}

// ✅ Good
function getData(): Promise<ApiResponse> {
  return fetch('/api').then(r => r.json());
}
```

### React Issues

```typescript
// ❌ Bad - missing types
const Component = ({ data }) => {
  return <div>{data}</div>;
};

// ✅ Good - explicit types
interface ComponentProps {
  data: string;
}

const Component = ({ data }: ComponentProps): JSX.Element => {
  return <div>{data}</div>;
};
```

### Database Issues

```typescript
// ❌ Bad - string concatenation
db.query(`SELECT * FROM users WHERE id = ${userId}`);

// ✅ Good - parameterized query
db.query("SELECT * FROM users WHERE id = ?", [userId]);
```

## Final Validation

After review passes:

```bash
!`cd /Users/home/hyperscape-5 && echo "=== FINAL VALIDATION ===" && echo "✅ All automated checks passed" && echo "✅ Manual review completed" && echo "✅ Ready to commit" && echo && git status -s`
```

## See Also

- `/git/commit` - Create commit after review
- `/check-types` - Type validation
- `/test` - Run test suite
- `/lint` - Code quality check
- `/deploy-check` - Full deployment checklist
