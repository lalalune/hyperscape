#!/bin/bash
# Pre-tool-use hook: Validate TypeScript strong typing rules

set -e

TARGET_PATH="${1:-packages/plugin-hyperscape/src}"
VIOLATIONS_FOUND=0

echo "🔍 Validating TypeScript types in $TARGET_PATH..."

# Check for 'any' types
if grep -rn ":\s*any\b" "$TARGET_PATH" --include="*.ts" --exclude-dir=node_modules 2>/dev/null; then
    echo "❌ Found 'any' types - violation of strong typing rules"
    VIOLATIONS_FOUND=1
fi

# Check for 'unknown' types
if grep -rn ":\s*unknown\b" "$TARGET_PATH" --include="*.ts" --exclude-dir=node_modules 2>/dev/null; then
    echo "❌ Found 'unknown' types - violation of strong typing rules"
    VIOLATIONS_FOUND=1
fi

# Check for 'as any' casts
if grep -rn "as any" "$TARGET_PATH" --include="*.ts" --exclude-dir=node_modules 2>/dev/null; then
    echo "❌ Found 'as any' casts - violation of strong typing rules"
    VIOLATIONS_FOUND=1
fi

if [ $VIOLATIONS_FOUND -eq 1 ]; then
    echo ""
    echo "⚠️  Type violations found. See CLAUDE.md for strong typing guidelines."
    echo ""
    exit 1
fi

echo "✅ Type validation passed"
exit 0
