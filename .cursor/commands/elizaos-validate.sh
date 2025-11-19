#!/bin/bash

# elizaos-validate.sh - Validate plugin code against ElizaOS patterns
# This script prompts the agent to validate code using Deepwiki MCP

# Read the command arguments
target="$*"

if [ -z "$target" ]; then
  cat << EOF
{
  "command": "elizaos-validate",
  "message": "Please provide a file path or component name. Usage: /elizaos-validate <file or component>\n\nExamples:\n- /elizaos-validate packages/plugin-eliza/src/actions/movement.ts\n- /elizaos-validate action implementation\n- /elizaos-validate provider patterns"
}
EOF
  exit 0
fi

cat << EOF
{
  "command": "elizaos-validate",
  "target": "${target}",
  "instructions": "You have been asked to validate plugin code against current ElizaOS patterns.\n\n**MANDATORY STEPS:**\n\n1. **Read** the specified file(s) or search for the component: ${target}\n2. **Use Deepwiki MCP** (mcp_deepwiki_ask_question) to get current ElizaOS documentation\n3. **Compare** implementation with current patterns:\n   - Action interface structure\n   - Provider interface structure\n   - Service lifecycle patterns\n   - Event handling patterns\n   - Configuration patterns\n4. **Identify** any deviations or outdated patterns\n5. **Provide** specific recommendations:\n   - What needs to change\n   - Why it needs to change\n   - How to fix it\n   - Reference to current documentation\n\n**Validation Checklist:**\n- ✅ Action follows current Action interface\n- ✅ Provider follows current Provider interface\n- ✅ Service follows current Service lifecycle\n- ✅ Event handlers follow current patterns\n- ✅ Configuration uses current schema patterns\n- ✅ Types match current ElizaOS types\n- ✅ Examples array present in actions\n- ✅ Dynamic flag set in providers\n- ✅ Error handling follows current patterns\n\n**Output Format:**\nFor each validation, provide:\n1. **Status**: ✅ Compliant | ⚠️ Needs Updates | ❌ Non-Compliant\n2. **Issues Found**: List of specific issues\n3. **Current Pattern**: What the current ElizaOS pattern is\n4. **Recommendations**: How to fix issues\n5. **Documentation Reference**: Link to relevant docs"
}
EOF

exit 0

