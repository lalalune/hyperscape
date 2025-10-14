#!/bin/bash
# Pre-commit hook: Validate code quality before commits

set -e

echo "🔍 Running pre-commit checks..."

# 1. Type validation
echo ""
echo "1️⃣  Validating TypeScript types..."
bash .claude-plugin/hooks/validate-types.sh packages/plugin-hyperscape/src

# 2. Check for TODOs in production code (warnings only)
echo ""
echo "2️⃣  Checking for TODOs..."
TODO_COUNT=$(grep -rn "TODO" packages/plugin-hyperscape/src --include="*.ts" --exclude-dir=node_modules | wc -l || echo "0")
if [ "$TODO_COUNT" -gt 0 ]; then
    echo "⚠️  Found $TODO_COUNT TODOs in code (resolve before shipping)"
else
    echo "✅ No TODOs found"
fi

# 3. Check that all actions have tests
echo ""
echo "3️⃣  Checking test coverage..."
ACTION_FILES=$(find packages/plugin-hyperscape/src/actions -name "*.ts" ! -name "index.ts" | wc -l)
TEST_FILES=$(find packages/plugin-hyperscape/src/__tests__/actions -name "*.test.ts" 2>/dev/null | wc -l || echo "0")
echo "Actions: $ACTION_FILES, Tests: $TEST_FILES"

if [ "$ACTION_FILES" -gt "$TEST_FILES" ]; then
    echo "⚠️  Some actions may be missing tests"
else
    echo "✅ Test files present for actions"
fi

echo ""
echo "✅ Pre-commit checks passed"
exit 0
