#!/bin/bash

# enforce-plugin-rules.sh - Enforces Hyperscape plugin rules after file edits
# This hook runs after file edits to check for rule violations

# Read JSON input from stdin
input=$(cat)

# Parse file path and edits
file_path=$(echo "$input" | jq -r '.file_path // ""' 2>/dev/null || echo "")
edits=$(echo "$input" | jq -r '.edits // []' 2>/dev/null || echo "[]")

# Only check plugin-eliza files
if [[ ! "$file_path" =~ packages/plugin-eliza ]]; then
  exit 0
fi

# Collect violations
violations=()

# Read the edited file content
if [ -f "$file_path" ]; then
  content=$(cat "$file_path")
else
  exit 0
fi

# Check 1: Direct world access (should use service)
if echo "$content" | grep -qE "(this\.world|world\.|new World\(|World\.getInstance)"; then
  if ! echo "$content" | grep -qE "(getService|HyperscapeService)"; then
    violations+=("⚠️  Direct world access detected. Use HyperscapeService instead of direct world access.")
  fi
fi

# Check 2: Missing service availability check
if echo "$content" | grep -qE "(runtime\.getService|service\s*=.*getService)"; then
  if ! echo "$content" | grep -qE "(if\s*\(!service|service\s*&&|service\s*\|\|)"; then
    violations+=("⚠️  Missing service availability check. Always check if service exists before use.")
  fi
fi

# Check 3: Using 'any' type
if echo "$content" | grep -qE ":\s*any\b|as\s+any\b|any\[\]"; then
  violations+=("⚠️  'any' type detected. Use proper types or 'unknown' with type guards.")
fi

# Check 4: Missing error handling in async functions
if echo "$content" | grep -qE "async\s+(function|\(|=>)"; then
  if ! echo "$content" | grep -qE "(try\s*\{|catch\s*\(|\.catch\()"; then
    violations+=("⚠️  Missing error handling in async function. Wrap async operations in try-catch.")
  fi
fi

# Check 5: Actions without examples
if echo "$content" | grep -qE "export\s+const\s+\w+Action:\s*Action\s*="; then
  if ! echo "$content" | grep -qE "examples:\s*\["; then
    violations+=("⚠️  Action missing 'examples' array. Actions require examples for LLM training.")
  fi
fi

# Check 6: Providers without dynamic flag
if echo "$content" | grep -qE "export\s+const\s+\w+Provider:\s*Provider\s*="; then
  if ! echo "$content" | grep -qE "dynamic:\s*true"; then
    violations+=("⚠️  Provider missing 'dynamic: true' flag. Real-time game data providers should be dynamic.")
  fi
fi

# Check 7: Import from 'three' instead of '@hyperscape/shared'
if echo "$content" | grep -qE "from\s+['\"]three['\"]"; then
  violations+=("⚠️  Importing from 'three' directly. Use THREE from '@hyperscape/shared' instead.")
fi

# Check 8: Hardcoded values instead of config
if echo "$content" | grep -qE "(5000|10000|30000|localhost:3000|ws://localhost)"; then
  if ! echo "$content" | grep -qE "(NETWORK_CONFIG|AGENT_CONFIG|CONTROLS_CONFIG|process\.env)"; then
    violations+=("💡 Hardcoded values detected. Consider using config/constants.ts instead.")
  fi
fi

# Check 9: Missing JSDoc comments on exported functions
if echo "$content" | grep -qE "export\s+(async\s+)?(function|const)\s+\w+"; then
  if ! echo "$content" | grep -qE "/\*\*|\* @"; then
    violations+=("💡 Missing JSDoc comments. Document exported functions with parameters and return types.")
  fi
fi

# Output violations if any
if [ ${#violations[@]} -gt 0 ]; then
  violations_text=$(IFS=$'\n'; echo "${violations[*]}")
  
  cat << EOF
{
  "continue": true,
  "user_message": "Plugin Rules Check:\n\n${violations_text}\n\nPlease review and fix these issues. See .cursor/rules/hyperscape-plugin-eliza.mdc for guidelines.",
  "agent_message": "Plugin rules violations detected:\n\n${violations_text}\n\nPlease fix these issues:\n1. Review .cursor/rules/hyperscape-plugin-eliza.mdc\n2. Follow the patterns shown in the rules\n3. Ensure all actions have examples\n4. Ensure providers have dynamic flag\n5. Use HyperscapeService instead of direct world access\n6. Add proper error handling\n7. Use proper TypeScript types (no 'any')\n8. Import THREE from '@hyperscape/shared'\n9. Use config constants instead of hardcoded values\n10. Add JSDoc comments to exported functions"
}
EOF
else
  # No violations
  exit 0
fi

exit 0
