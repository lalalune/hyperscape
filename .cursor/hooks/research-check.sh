#!/bin/bash

# research-check.sh - Checks if research is needed before reading files
# This hook runs before reading files to remind about research requirements

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

# Files that suggest complex implementation
complex_files=(
  "service.ts"
  "index.ts"
  "actions/"
  "providers/"
  "managers/"
  "systems/"
)

# Check if file suggests complex implementation
requires_research=false
for pattern in "${complex_files[@]}"; do
  if [[ "$file_path" =~ $pattern ]]; then
    requires_research=true
    break
  fi
done

# If research is needed, provide reminder (but allow read)
if [ "$requires_research" = true ]; then
  cat << EOF
{
  "permission": "allow",
  "user_message": "🔍 Research Reminder: Before modifying this file, ensure you've:\n\n1. Reviewed ElizaOS documentation\n2. Checked existing patterns\n3. Used Context7 MCP for current best practices\n4. Reviewed plugin rules",
  "agent_message": "Before modifying this file, please ensure you've researched:\n\n1. ElizaOS Plugin Architecture (https://docs.elizaos.ai/plugins/architecture)\n2. Existing patterns in similar files\n3. Current best practices using Context7 MCP\n4. Plugin rules in .cursor/rules/hyperscape-plugin-eliza.mdc\n\nThis file is part of the core plugin structure - changes should follow established patterns."
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
