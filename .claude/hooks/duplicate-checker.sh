#!/bin/bash

# duplicate-checker.sh - Checks for duplicate code patterns before edits
# This hook runs after file edits to detect potential duplicates

# Read JSON input from stdin
input=$(cat)

# Parse file path and edits
file_path=$(echo "$input" | jq -r '.file_path // ""' 2>/dev/null || echo "")
edits=$(echo "$input" | jq -r '.edits // []' 2>/dev/null || echo "[]")

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

# Extract function/class names that might indicate duplication
warnings=()

# Check for common duplicate patterns
if echo "$content" | grep -qE "export\s+(const|function|class)\s+\w+"; then
  # Extract exported names
  exported_names=$(echo "$content" | grep -oE "export\s+(const|function|class)\s+\w+" | sed 's/export\s\+\(const\|function\|class\)\s\+//')
  
  for name in $exported_names; do
    # Check if similar name exists elsewhere (basic check)
    if [ -n "$name" ]; then
      # This is a simple check - in practice, you'd want more sophisticated duplicate detection
      # For now, we'll just warn about potential duplicates
      if echo "$name" | grep -qiE "(new|copy|v2|enhanced|simple|improved|better)"; then
        warnings+=("⚠️  Exported name '$name' suggests duplication. Check if similar functionality exists.")
      fi
    fi
  done
fi

# Check for hardcoded patterns that might exist elsewhere
if echo "$content" | grep -qE "(localhost:3000|ws://localhost|5000|10000|30000)"; then
  if ! echo "$content" | grep -qE "(NETWORK_CONFIG|AGENT_CONFIG|CONTROLS_CONFIG|process\.env)"; then
    warnings+=("💡 Hardcoded values detected. Check config/constants.ts for existing constants.")
  fi
fi

# Check for import patterns that might indicate duplication
if echo "$content" | grep -qE "from\s+['\"]\.\./\.\./"; then
  # Deep imports might indicate wrong file location
  warnings+=("💡 Deep relative imports detected. Consider if file is in correct location.")
fi

# Output warnings if any
if [ ${#warnings[@]} -gt 0 ]; then
  warnings_text=$(IFS=$'\n'; echo "${warnings[*]}")
  
  cat << EOF
{
  "continue": true,
  "user_message": "Duplicate/Pattern Check:\n\n${warnings_text}\n\nPlease verify no duplicate code exists.",
  "agent_message": "Potential duplicate patterns detected:\n\n${warnings_text}\n\nPlease:\n1. Search codebase for similar implementations\n2. Check if functionality already exists\n3. Consider reusing existing code\n4. Verify file is in correct location\n5. Check config/constants.ts for existing constants"
}
EOF
else
  exit 0
fi

exit 0

