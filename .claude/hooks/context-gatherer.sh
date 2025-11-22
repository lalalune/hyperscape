#!/bin/bash

# context-gatherer.sh - Gathers codebase context before making changes
# This hook runs before prompt submission to gather relevant context

# Read JSON input from stdin
input=$(cat)

# Parse the prompt text
prompt=$(echo "$input" | jq -r '.prompt // ""' 2>/dev/null || echo "")

# Extract keywords that suggest what we're working on
keywords=()
if echo "$prompt" | grep -qiE "\b(action|actions)\b"; then
  keywords+=("action")
fi
if echo "$prompt" | grep -qiE "\b(provider|providers)\b"; then
  keywords+=("provider")
fi
if echo "$prompt" | grep -qiE "\b(service|services)\b"; then
  keywords+=("service")
fi
if echo "$prompt" | grep -qiE "\b(manager|managers)\b"; then
  keywords+=("manager")
fi
if echo "$prompt" | grep -qiE "\b(system|systems)\b"; then
  keywords+=("system")
fi
if echo "$prompt" | grep -qiE "\b(move|movement|walk|travel|goto)\b"; then
  keywords+=("movement")
fi
if echo "$prompt" | grep -qiE "\b(combat|attack|fight|battle)\b"; then
  keywords+=("combat")
fi
if echo "$prompt" | grep -qiE "\b(inventory|item|equip|drop|use)\b"; then
  keywords+=("inventory")
fi
if echo "$prompt" | grep -qiE "\b(skill|skills|gather|chop|fish|cook|mine)\b"; then
  keywords+=("skills")
fi
if echo "$prompt" | grep -qiE "\b(bank|banking|deposit|withdraw)\b"; then
  keywords+=("banking")
fi
if echo "$prompt" | grep -qiE "\b(chat|message|social|reply)\b"; then
  keywords+=("social")
fi

# If no specific keywords, check for general implementation terms
if [ ${#keywords[@]} -eq 0 ]; then
  if echo "$prompt" | grep -qiE "\b(implement|create|add|build|new|make|write|code)\b"; then
    keywords+=("implementation")
  fi
fi

# Only gather context if we have relevant keywords
if [ ${#keywords[@]} -eq 0 ]; then
  cat << EOF
{
  "continue": true
}
EOF
  exit 0
fi

# Build context message with specific guidance
context_parts=()
context_parts+=("🔍 **Context Gathering Required Before Implementation**")
context_parts+=("")
context_parts+=("Before implementing, you MUST gather context using codebase_search, grep, or read_file:")

# Add specific checks based on keywords
if [[ " ${keywords[@]} " =~ " action " ]]; then
  context_parts+=("")
  context_parts+=("**For Actions:**")
  context_parts+=("1. Search: 'How are actions implemented in the plugin?'")
  context_parts+=("2. Read: packages/plugin-eliza/src/actions/movement.ts (reference)")
  context_parts+=("3. Check: packages/plugin-eliza/src/actions/ for similar actions")
  context_parts+=("4. Verify: Action follows ElizaOS Action interface")
  context_parts+=("5. Ensure: Action has examples array for LLM training")
fi

if [[ " ${keywords[@]} " =~ " provider " ]]; then
  context_parts+=("")
  context_parts+=("**For Providers:**")
  context_parts+=("1. Search: 'How are providers implemented in the plugin?'")
  context_parts+=("2. Read: packages/plugin-eliza/src/providers/gameState.ts (reference)")
  context_parts+=("3. Check: packages/plugin-eliza/src/providers/ for similar providers")
  context_parts+=("4. Ensure: Provider has dynamic: true flag")
  context_parts+=("5. Set: Provider position number for ordering")
fi

if [[ " ${keywords[@]} " =~ " service " ]] || [[ " ${keywords[@]} " =~ " manager " ]]; then
  context_parts+=("")
  context_parts+=("**For Services/Managers:**")
  context_parts+=("1. Search: 'How are services and managers implemented?'")
  context_parts+=("2. Read: packages/plugin-eliza/src/service.ts (main service)")
  context_parts+=("3. Read: packages/plugin-eliza/src/managers/behavior-manager.ts (example)")
  context_parts+=("4. Check: Manager initialization order in service.ts")
  context_parts+=("5. Ensure: Manager gets service from runtime, not creates new instance")
fi

if [[ " ${keywords[@]} " =~ " system " ]]; then
  context_parts+=("")
  context_parts+=("**For Systems:**")
  context_parts+=("1. Search: 'How are Hyperscape systems implemented?'")
  context_parts+=("2. Read: packages/plugin-eliza/src/systems/actions.ts (reference)")
  context_parts+=("3. Ensure: System extends System from @hyperscape/shared")
  context_parts+=("4. Use: THREE from @hyperscape/shared, not direct 'three' import")
  context_parts+=("5. Implement: init(), start(), destroy() methods")
fi

# Add specific action category checks
if [[ " ${keywords[@]} " =~ " movement " ]]; then
  context_parts+=("")
  context_parts+=("**Movement Actions:**")
  context_parts+=("- Check: packages/plugin-eliza/src/actions/movement.ts")
  context_parts+=("- Existing: MOVE_TO, FOLLOW_ENTITY, STOP_MOVEMENT")
  context_parts+=("- Pattern: Parse coordinates from message.content.text")
fi

if [[ " ${keywords[@]} " =~ " combat " ]]; then
  context_parts+=("")
  context_parts+=("**Combat Actions:**")
  context_parts+=("- Check: packages/plugin-eliza/src/actions/combat.ts")
  context_parts+=("- Existing: ATTACK_ENTITY, CHANGE_COMBAT_STYLE")
fi

if [[ " ${keywords[@]} " =~ " inventory " ]]; then
  context_parts+=("")
  context_parts+=("**Inventory Actions:**")
  context_parts+=("- Check: packages/plugin-eliza/src/actions/inventory.ts")
  context_parts+=("- Existing: EQUIP_ITEM, USE_ITEM, DROP_ITEM")
fi

if [[ " ${keywords[@]} " =~ " skills " ]]; then
  context_parts+=("")
  context_parts+=("**Skills Actions:**")
  context_parts+=("- Check: packages/plugin-eliza/src/actions/skills.ts")
  context_parts+=("- Existing: CHOP_TREE, CATCH_FISH, LIGHT_FIRE, COOK_FOOD")
fi

# Always add general context gathering requirements
context_parts+=("")
context_parts+=("**Required Context Gathering Steps:**")
context_parts+=("1. Use codebase_search to find similar implementations")
context_parts+=("2. Use grep to find existing patterns")
context_parts+=("3. Read reference files mentioned above")
context_parts+=("4. Check .cursor/rules/plugin-eliza-*.mdc for patterns")
context_parts+=("5. Verify no duplicate functionality exists")
context_parts+=("6. Check imports and dependencies")
context_parts+=("7. Review plugin structure in packages/plugin-eliza/src/index.ts")

context_message=$(IFS=$'\n'; echo "${context_parts[*]}")

cat << EOF
{
  "continue": true,
  "user_message": "${context_message}",
  "agent_message": "${context_message}\n\n**MANDATORY:** Before writing any code, you MUST:\n\n1. Use codebase_search tool to find similar implementations\n2. Use grep tool to search for existing patterns\n3. Read the reference files mentioned above\n4. Check .cursor/rules/plugin-eliza-*.mdc for detailed patterns\n5. Verify no duplicate code exists\n6. Ensure consistency with existing codebase\n\nOnly proceed with implementation after gathering this context. This prevents:\n- Code duplication\n- Inconsistent patterns\n- Breaking existing functionality\n- Missing required patterns (examples, dynamic flags, etc.)"
}
EOF

exit 0
