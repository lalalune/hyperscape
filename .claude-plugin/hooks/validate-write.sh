#!/bin/bash
# Pre-Write/Edit hook: Validate file writes follow project conventions

set -e

FILE_PATH="$1"

# Allow writes if no file path specified
if [ -z "$FILE_PATH" ]; then
    exit 0
fi

echo "🔍 Validating write to: $FILE_PATH"

# Check if creating new files unnecessarily
if [ ! -f "$FILE_PATH" ]; then
    FILENAME=$(basename "$FILE_PATH")

    # Check for _v2, _new, _copy patterns
    if echo "$FILENAME" | grep -qE "_v[0-9]+|_new|_copy|_old"; then
        echo "❌ Avoid creating versioned files (_v2, _new, _copy)"
        echo "   Edit existing files instead"
        echo "   File: $FILE_PATH"
        exit 1
    fi

    echo "⚠️  Creating new file: $FILE_PATH"
    echo "   Ensure this is necessary (prefer editing existing files)"
fi

# Check for correct file location
if [[ "$FILE_PATH" == *"/actions/"* ]] && [[ "$FILE_PATH" != *"packages/plugin-hyperscape/src/actions/"* ]]; then
    echo "❌ Actions should be in packages/plugin-hyperscape/src/actions/"
    exit 1
fi

if [[ "$FILE_PATH" == *"/providers/"* ]] && [[ "$FILE_PATH" != *"packages/plugin-hyperscape/src/providers/"* ]]; then
    echo "❌ Providers should be in packages/plugin-hyperscape/src/providers/"
    exit 1
fi

echo "✅ Write validation passed"
exit 0
