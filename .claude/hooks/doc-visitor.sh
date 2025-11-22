#!/bin/bash

# doc-visitor.sh - Tool to suggest relevant ElizaOS documentation pages
# This tool analyzes file paths and tasks to suggest relevant docs

# Read JSON input from stdin
input=$(cat)

# Parse file path or task
file_path=$(echo "$input" | jq -r '.file_path // ""' 2>/dev/null || echo "")
task=$(echo "$input" | jq -r '.task // ""' 2>/dev/null || echo "")
prompt=$(echo "$input" | jq -r '.prompt // ""' 2>/dev/null || echo "")

# Determine context
context=""
if [ -n "$file_path" ]; then
  context="$file_path"
elif [ -n "$task" ]; then
  context="$task"
elif [ -n "$prompt" ]; then
  context="$prompt"
else
  exit 0
fi

# Map file paths/tasks to documentation pages
docs=()

# Actions
if echo "$context" | grep -qiE "(action|actions)/.*\.ts"; then
  docs+=("https://docs.elizaos.ai/guides/create-a-plugin - Action patterns and implementation")
  docs+=("https://docs.elizaos.ai/plugins/architecture - Action interface structure")
  docs+=("https://docs.elizaos.ai/plugins/components - Action component details")
fi

# Providers
if echo "$context" | grep -qiE "(provider|providers)/.*\.ts"; then
  docs+=("https://docs.elizaos.ai/guides/create-a-plugin - Provider patterns and implementation")
  docs+=("https://docs.elizaos.ai/plugins/architecture - Provider interface structure")
  docs+=("https://docs.elizaos.ai/runtime/providers - Provider system details")
fi

# Services
if echo "$context" | grep -qiE "(service|services)/.*\.ts"; then
  docs+=("https://docs.elizaos.ai/guides/create-a-plugin - Service patterns and implementation")
  docs+=("https://docs.elizaos.ai/plugins/architecture - Service interface structure")
  docs+=("https://docs.elizaos.ai/runtime/services - Service lifecycle")
fi

# Plugin entry point
if echo "$context" | grep -qiE "(index\.ts|plugin\.ts)"; then
  docs+=("https://docs.elizaos.ai/plugins/architecture - Plugin interface")
  docs+=("https://docs.elizaos.ai/guides/create-a-plugin - Plugin structure")
  docs+=("https://docs.elizaos.ai/projects/overview - Project structure")
fi

# Configuration
if echo "$context" | grep -qiE "(config|\.env|environment)"; then
  docs+=("https://docs.elizaos.ai/projects/environment-variables - Environment variables")
  docs+=("https://docs.elizaos.ai/plugins/architecture - Plugin configuration")
fi

# Event handlers
if echo "$context" | grep -qiE "(event|handler|events)"; then
  docs+=("https://docs.elizaos.ai/runtime/events - Event system")
  docs+=("https://docs.elizaos.ai/plugins/architecture - Event handlers")
fi

# Tests
if echo "$context" | grep -qiE "(test|__tests__|spec)"; then
  docs+=("https://docs.elizaos.ai/guides/test-a-project - Testing strategies")
  docs+=("https://docs.elizaos.ai/guides/create-a-plugin - Plugin testing")
fi

# Managers
if echo "$context" | grep -qiE "(manager|managers)"; then
  docs+=("https://docs.elizaos.ai/runtime/services - Service patterns (managers are services)")
  docs+=("https://docs.elizaos.ai/plugins/architecture - Service lifecycle")
fi

# Systems
if echo "$context" | grep -qiE "(system|systems)"; then
  docs+=("https://docs.elizaos.ai/plugins/architecture - Plugin architecture")
  docs+=("https://docs.elizaos.ai/runtime/core - Runtime core")
fi

# Keywords in prompt/task
if echo "$context" | grep -qiE "\b(action|actions)\b"; then
  docs+=("https://docs.elizaos.ai/guides/create-a-plugin - Creating actions")
  docs+=("https://docs.elizaos.ai/plugins/architecture - Action interface")
fi

if echo "$context" | grep -qiE "\b(provider|providers)\b"; then
  docs+=("https://docs.elizaos.ai/guides/create-a-plugin - Creating providers")
  docs+=("https://docs.elizaos.ai/runtime/providers - Provider system")
fi

if echo "$context" | grep -qiE "\b(service|services)\b"; then
  docs+=("https://docs.elizaos.ai/guides/create-a-plugin - Creating services")
  docs+=("https://docs.elizaos.ai/runtime/services - Service lifecycle")
fi

if echo "$context" | grep -qiE "\b(plugin|plugins)\b"; then
  docs+=("https://docs.elizaos.ai/guides/create-a-plugin - Plugin creation guide")
  docs+=("https://docs.elizaos.ai/plugins/architecture - Plugin architecture")
fi

if echo "$context" | grep -qiE "\b(test|testing)\b"; then
  docs+=("https://docs.elizaos.ai/guides/test-a-project - Testing guide")
  docs+=("https://docs.elizaos.ai/guides/create-a-plugin - Plugin testing")
fi

# Remove duplicates
unique_docs=$(printf '%s\n' "${docs[@]}" | sort -u)

if [ ${#unique_docs[@]} -eq 0 ]; then
  exit 0
fi

# Format output
docs_text=$(printf '%s\n' "${unique_docs[@]}")

cat << EOF
{
  "continue": true,
  "user_message": "📚 **Relevant ElizaOS Documentation Pages:**\n\n${docs_text}\n\nPlease visit these pages before implementing to ensure you're following current patterns.",
  "agent_message": "📚 **MANDATORY: Visit These Documentation Pages**\n\nBefore implementing, you MUST visit and review:\n\n${docs_text}\n\n**Why:**\n- Ensures you're using current ElizaOS patterns\n- Prevents outdated implementation patterns\n- Validates interface structures\n- Confirms best practices\n\n**How:**\n1. Use web_search with site:docs.elizaos.ai\n2. Use Context7 MCP (mcp_context7_get-library-docs)\n3. Use Deepwiki MCP (mcp_deepwiki_ask_question)\n4. Read the pages before coding\n\n**After Reading:**\n- Compare with existing code patterns\n- Verify interface structures match\n- Ensure you're following current best practices"
}
EOF

exit 0

