#!/bin/bash

# cursor-files-reminder.sh - Reminds agent to use .cursor files generously
# Runs before prompt submission to encourage use of rules, memories, hooks, commands, and tools

# Read JSON input from stdin
input=$(cat)

# Parse prompt or file path
prompt=$(echo "$input" | jq -r '.prompt // ""' 2>/dev/null || echo "")
file_path=$(echo "$input" | jq -r '.file_path // ""' 2>/dev/null || echo "")

# Only check plugin-eliza files or prompts related to plugin development
if [ -n "$file_path" ] && [[ ! "$file_path" =~ packages/plugin-eliza ]]; then
  exit 0
fi

# Check for keywords that suggest implementation work
implementation_keywords=(
  "implement" "create" "add" "build" "write" "develop" "make" "new"
  "action" "provider" "service" "evaluator" "manager" "system"
  "fix" "update" "modify" "change" "refactor" "improve"
  "test" "debug" "error" "bug" "issue"
)

# Check if prompt contains implementation keywords
is_implementation=false
for keyword in "${implementation_keywords[@]}"; do
  if echo "$prompt" | grep -qi "$keyword"; then
    is_implementation=true
    break
  fi
done

# If not implementation-related, exit
if [ "$is_implementation" = false ] && [ -z "$file_path" ]; then
  exit 0
fi

# Determine context
context=""
if [ -n "$file_path" ]; then
  if [[ "$file_path" =~ actions/ ]]; then
    context="action"
  elif [[ "$file_path" =~ providers/ ]]; then
    context="provider"
  elif [[ "$file_path" =~ services/ ]]; then
    context="service"
  elif [[ "$file_path" =~ managers/ ]]; then
    context="manager"
  elif [[ "$file_path" =~ systems/ ]]; then
    context="system"
  elif [[ "$file_path" =~ __tests__/ ]]; then
    context="test"
  fi
fi

# Build reminder message
reminder=""
reminder+="\n📚 REMINDER: Use .cursor files generously!\n"
reminder+="==========================================\n\n"

# Context-specific suggestions
if [ -n "$context" ]; then
  reminder+="📋 For $context development:\n"
  case "$context" in
    "action")
      reminder+="   ✅ Check: .cursor/rules/plugin-eliza-actions.mdc\n"
      reminder+="   ✅ Check: .cursor/rules/plugin-eliza-action-patterns.mdc\n"
      reminder+="   ✅ Check: .cursor/memory/elizaos-action-patterns.md\n"
      reminder+="   ✅ Check: .cursor/memory/agent-development-patterns.md\n"
      reminder+="   ✅ Use: /elizaos-research action interface\n"
      ;;
    "provider")
      reminder+="   ✅ Check: .cursor/rules/plugin-eliza-providers.mdc\n"
      reminder+="   ✅ Check: .cursor/rules/plugin-eliza-provider-patterns.mdc\n"
      reminder+="   ✅ Check: .cursor/memory/elizaos-providers.md\n"
      reminder+="   ✅ Check: .cursor/memory/agent-development-patterns.md\n"
      reminder+="   ✅ Use: /elizaos-research provider patterns\n"
      ;;
    "service")
      reminder+="   ✅ Check: .cursor/rules/plugin-eliza-services-runtime.mdc\n"
      reminder+="   ✅ Check: .cursor/memory/elizaos-services.md\n"
      reminder+="   ✅ Check: .cursor/memory/agent-development-patterns.md\n"
      reminder+="   ✅ Use: /elizaos-research service lifecycle\n"
      ;;
    "manager")
      reminder+="   ✅ Check: .cursor/rules/plugin-eliza-service-managers.mdc\n"
      reminder+="   ✅ Check: .cursor/memory/agent-development-patterns.md\n"
      ;;
    "system")
      reminder+="   ✅ Check: .cursor/rules/plugin-eliza-systems-testing.mdc\n"
      reminder+="   ✅ Check: .cursor/memory/agent-development-patterns.md\n"
      ;;
    "test")
      reminder+="   ✅ Check: .cursor/rules/testing.mdc\n"
      reminder+="   ✅ Check: .cursor/rules/plugin-eliza-systems-testing.mdc\n"
      reminder+="   ✅ Check: .cursor/memory/agent-workflow-procedures.md\n"
      ;;
  esac
  reminder+="\n"
fi

# General reminders
reminder+="🔍 Always check these before implementing:\n"
reminder+="   ✅ .cursor/rules/ - 39 rule files with patterns\n"
reminder+="   ✅ .cursor/memory/ - 20 memory files with references\n"
reminder+="   ✅ .cursor/memory/agent-project-context.md - Project context\n"
reminder+="   ✅ .cursor/memory/agent-development-patterns.md - Code patterns\n"
reminder+="   ✅ .cursor/memory/agent-workflow-procedures.md - Workflows\n"
reminder+="\n"

reminder+="🛠️ Use these tools generously:\n"
reminder+="   ✅ /elizaos-research <topic> - Research ElizaOS patterns\n"
reminder+="   ✅ /elizaos-validate <file> - Validate code\n"
reminder+="   ✅ .cursor/tools/doc-visitor.sh - Documentation suggestions\n"
reminder+="\n"

reminder+="📖 Key files to reference:\n"
reminder+="   ✅ .cursor/memory/master-index.md - Complete index\n"
reminder+="   ✅ .cursor/memory/rules-index.md - All rules\n"
reminder+="   ✅ .cursor/memory/hooks-index.md - All hooks\n"
reminder+="   ✅ .cursor/README.md - Directory overview\n"
reminder+="\n"

reminder+="💡 Best Practice:\n"
reminder+="   Before implementing ANY feature:\n"
reminder+="   1. Check relevant rule files\n"
reminder+="   2. Review memory files for patterns\n"
reminder+="   3. Use /elizaos-research for ElizaOS patterns\n"
reminder+="   4. Check existing code for similar implementations\n"
reminder+="   5. Follow established patterns from memories\n"
reminder+="\n"

reminder+="🎯 Remember: The .cursor directory has 73+ files specifically\n"
reminder+="   created to help you work effectively. Use them generously!\n"

# Output reminder
echo -e "$reminder"

exit 0

