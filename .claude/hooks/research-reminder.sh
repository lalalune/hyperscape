#!/bin/bash

# research-reminder.sh - Reminds to research before implementing complex changes
# This hook runs before prompt submission to remind about research requirements

# Read JSON input from stdin
input=$(cat)

# Parse the prompt text
prompt=$(echo "$input" | jq -r '.prompt // ""' 2>/dev/null || echo "")

# Keywords that suggest complex implementation requiring research
research_keywords=(
  "implement"
  "create"
  "add"
  "build"
  "new"
  "feature"
  "plugin"
  "service"
  "action"
  "provider"
  "system"
  "manager"
  "elizaos"
  "hyperscape"
  "api"
  "integration"
  "architecture"
  "refactor"
)

# Check if prompt contains research keywords
requires_research=false
for keyword in "${research_keywords[@]}"; do
  if echo "$prompt" | grep -qi "\b${keyword}\b"; then
    requires_research=true
    break
  fi
done

# If research is needed, provide reminder
if [ "$requires_research" = true ]; then
  cat << EOF
{
  "continue": true,
  "user_message": "🔍 Research Reminder: Before implementing, please:\n\n1. Check ElizaOS documentation: https://docs.elizaos.ai/\n2. Review plugin architecture: https://docs.elizaos.ai/plugins/architecture\n3. Check existing code patterns in packages/plugin-eliza/src/\n4. Use Context7 MCP or web search for current best practices\n5. Review .cursor/rules/hyperscape-plugin-eliza.mdc for patterns",
  "agent_message": "Before implementing this feature, please research:\n\n1. ElizaOS Plugin Architecture (https://docs.elizaos.ai/plugins/architecture)\n2. Existing patterns in the codebase (packages/plugin-eliza/src/)\n3. Current best practices using Context7 MCP or web search\n4. Plugin rules in .cursor/rules/hyperscape-plugin-eliza.mdc\n\nThis ensures we follow established patterns and avoid reinventing solutions."
}
EOF
else
  # Allow prompt to continue
  cat << EOF
{
  "continue": true
}
EOF
fi

exit 0
