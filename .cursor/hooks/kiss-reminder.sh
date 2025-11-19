#!/bin/bash

# kiss-reminder.sh - Reminds about Keep It Simple Stupid (KISS) principle
# This hook runs before prompt submission to remind about code simplicity

# Read JSON input from stdin
input=$(cat)

# Parse the prompt text
prompt=$(echo "$input" | jq -r '.prompt // ""' 2>/dev/null || echo "")

# Keywords that suggest over-engineering or complexity
complexity_keywords=(
  "complex"
  "sophisticated"
  "advanced"
  "optimize"
  "refactor"
  "architecture"
  "framework"
  "abstraction"
  "pattern"
  "design"
  "new file"
  "create new"
  "enhanced"
  "improved"
  "better"
)

# Keywords that suggest code duplication
duplication_keywords=(
  "new"
  "create"
  "add"
  "implement"
  "build"
)

# Check if prompt suggests complexity or duplication
suggests_complexity=false
suggests_duplication=false

for keyword in "${complexity_keywords[@]}"; do
  if echo "$prompt" | grep -qi "\b${keyword}\b"; then
    suggests_complexity=true
    break
  fi
done

for keyword in "${duplication_keywords[@]}"; do
  if echo "$prompt" | grep -qiE "\b(new|create|add|implement|build)\s+(file|component|module|class|function|action|provider|service|manager|system)"; then
    suggests_duplication=true
    break
  fi
done

# Provide reminders if needed
if [ "$suggests_complexity" = true ] || [ "$suggests_duplication" = true ]; then
  message=""
  
  if [ "$suggests_duplication" = true ]; then
    message="${message}♻️  Code Reuse Reminder:\n- Check if similar code already exists\n- Reuse existing components/utilities\n- Edit existing files instead of creating new ones\n- Follow DRY (Don't Repeat Yourself) principle\n\n"
  fi
  
  if [ "$suggests_complexity" = true ]; then
    message="${message}💡 KISS Principle Reminder:\n- Start with the simplest solution\n- Avoid premature optimization\n- Don't over-engineer\n- Build minimal working solution first\n- Measure before optimizing\n\n"
  fi
  
  cat << EOF
{
  "continue": true,
  "user_message": "${message}Review the prompt and consider:\n1. Can we reuse existing code?\n2. Is this the simplest solution?\n3. Do we really need this complexity?",
  "agent_message": "${message}Before proceeding, please:\n\n1. Search the codebase for existing similar implementations\n2. Consider if we can reuse/extend existing code\n3. Start with the simplest solution that works\n4. Avoid creating new files unless absolutely necessary\n5. Follow the KISS principle - Keep It Simple, Stupid\n\nCheck .cursor/rules/hyperscape-plugin-eliza.mdc for patterns and existing code structure."
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
