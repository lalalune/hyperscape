#!/bin/bash

# dependency-checker.sh - Checks imports and dependencies before edits
# This hook runs after file edits to verify imports are correct

# Read JSON input from stdin
input=$(cat)

# Parse file path
file_path=$(echo "$input" | jq -r '.file_path // ""' 2>/dev/null || echo "")

# Only check plugin-eliza files
if [[ ! "$file_path" =~ packages/plugin-eliza ]]; then
  exit 0
fi

# Read the edited file content
if [ -f "$file_path" ]; then
  content=$(cat "$file_path")
else
  exit 0
fi

warnings=()

# Check 1: Import from 'three' directly (should use @hyperscape/shared)
if echo "$content" | grep -qE "from\s+['\"]three['\"]"; then
  warnings+=("⚠️  Importing from 'three' directly. Use THREE from '@hyperscape/shared' instead.")
fi

# Check 2: Missing .js extension in ESM imports (for relative imports)
if echo "$content" | grep -qE "from\s+['\"]\.\.?/[^'\"]+['\"]"; then
  if ! echo "$content" | grep -qE "from\s+['\"]\.\.?/[^'\"]+\.js['\"]"; then
    # Check if it's a relative import (not @elizaos or @hyperscape)
    if ! echo "$content" | grep -qE "from\s+['\"]@"; then
      warnings+=("💡 Consider using .js extensions in ESM imports for better compatibility.")
    fi
  fi
fi

# Check 3: Import from wrong package
if echo "$content" | grep -qE "from\s+['\"]@hyperscape/(shared|core)['\"]"; then
  # Check if we're importing types that should come from @hyperscape/shared
  if echo "$content" | grep -qE "import.*(World|Player|Entity|System).*from.*@hyperscape/core"; then
    warnings+=("⚠️  World/Player/Entity/System should be imported from '@hyperscape/shared', not '@hyperscape/core'.")
  fi
fi

# Check 4: Duplicate type imports
if echo "$content" | grep -qE "import.*type.*from.*@hyperscape/shared"; then
  # Check if same types imported multiple times
  type_imports=$(echo "$content" | grep -oE "import.*type.*\{[^}]+\}.*from.*@hyperscape/shared" | head -5)
  if [ $(echo "$type_imports" | wc -l) -gt 1 ]; then
    warnings+=("💡 Multiple type imports from @hyperscape/shared detected. Consider consolidating.")
  fi
fi

# Check 5: Import from non-existent paths
if echo "$content" | grep -qE "from\s+['\"]\.\./[^'\"]+['\"]"; then
  # Basic check - would need more sophisticated path resolution for full validation
  # This is a placeholder for the concept
  :
fi

# Output warnings if any
if [ ${#warnings[@]} -gt 0 ]; then
  warnings_text=$(IFS=$'\n'; echo "${warnings[*]}")
  
  cat << EOF
{
  "continue": true,
  "user_message": "Dependency Check:\n\n${warnings_text}\n\nPlease verify imports are correct.",
  "agent_message": "Import/dependency issues detected:\n\n${warnings_text}\n\nPlease:\n1. Use THREE from '@hyperscape/shared', not 'three'\n2. Use .js extensions in ESM imports\n3. Import types from correct packages\n4. Consolidate duplicate imports\n5. Verify all import paths exist"
}
EOF
else
  exit 0
fi

exit 0

