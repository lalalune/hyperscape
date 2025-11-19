#!/bin/bash

# critical-file-protection.sh - Protects critical plugin files from accidental breaking changes
# This hook runs before file edits to warn about critical files

# Read JSON input from stdin
input=$(cat)

# Parse file path
file_path=$(echo "$input" | jq -r '.file_path // ""' 2>/dev/null || echo "")

# Only check plugin-eliza files
if [[ ! "$file_path" =~ packages/plugin-eliza ]]; then
  cat << EOF
{
  "permission": "allow"
}
EOF
  exit 0
fi

# Critical files that require extra caution
critical_files=(
  "packages/plugin-eliza/src/index.ts"
  "packages/plugin-eliza/src/service.ts"
  "packages/plugin-eliza/src/services/HyperscapeService.ts"
)

# Check if editing a critical file
is_critical=false
for critical in "${critical_files[@]}"; do
  if [[ "$file_path" =~ $critical ]]; then
    is_critical=true
    break
  fi
done

if [ "$is_critical" = true ]; then
  cat << EOF
{
  "permission": "allow",
  "user_message": "⚠️  Critical File Warning: You're editing a core plugin file.\n\nBefore making changes:\n1. Review existing implementation thoroughly\n2. Check .cursor/rules/plugin-eliza-*.mdc\n3. Verify changes won't break plugin registration\n4. Test plugin initialization after changes",
  "agent_message": "⚠️  CRITICAL FILE WARNING\n\nYou are editing a core plugin file: ${file_path}\n\nBefore making changes, you MUST:\n\n1. **Read the entire file** to understand current implementation\n2. **Review plugin rules** in .cursor/rules/plugin-eliza-*.mdc\n3. **Check plugin registration** in packages/plugin-eliza/src/index.ts\n4. **Verify component order** (services → providers → actions → events)\n5. **Test plugin initialization** after changes\n6. **Ensure backward compatibility** if changing interfaces\n\nThese files are critical to plugin functionality. Changes here affect:\n- Plugin registration and initialization\n- Service lifecycle\n- Component loading order\n- Runtime behavior\n\nProceed with extreme caution and thorough testing."
}
EOF
else
  cat << EOF
{
  "permission": "allow"
}
EOF
fi

exit 0

