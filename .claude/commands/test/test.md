---
description: Run tests with bun test
allowed-tools: [Bash]
argument-hint: [watch|coverage|pattern]
---

# Run Tests

Run tests using Bun test runner. Follows **NO mocks** policy - real instances only.

## Run All Tests

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== Test Suite ===" && bun test 2>&1 && echo -e "\n✅ All tests passed" || (echo -e "\n❌ Tests failed" && exit 1)`
```

## Watch Mode

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== Test Watch Mode ===" && bun test --watch`
```

## Coverage Report

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== Test Coverage ===" && bun test --coverage`
```

## Specific Pattern

```bash
!`if [ -n "$ARGUMENTS" ]; then cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== Tests: $ARGUMENTS ===" && bun test $ARGUMENTS; else echo "Provide pattern: /test/test <pattern>"; fi`
```

## Testing Standards

Per CLAUDE.md:
- **NO mocks or spies** - Use real instances
- Build mini-worlds for feature tests
- Visual verification for 3D components
- Test data + visual output

## See Also

- `/test` - Full test command with documentation
- `/test/3d-test` - Test 3D viewer components
