#!/bin/bash

# elizaos-research.sh - Research ElizaOS documentation using Deepwiki MCP
# This script prompts the agent to use Deepwiki MCP for ElizaOS research

# Read the command arguments
query="$*"

if [ -z "$query" ]; then
  cat << EOF
{
  "command": "elizaos-research",
  "message": "Please provide a research topic. Usage: /elizaos-research <topic>\n\nExamples:\n- /elizaos-research How do I create a new action?\n- /elizaos-research Provider interface structure\n- /elizaos-validate Service lifecycle patterns"
}
EOF
  exit 0
fi

cat << EOF
{
  "command": "elizaos-research",
  "query": "${query}",
  "instructions": "You have been asked to research ElizaOS documentation using Deepwiki MCP.\n\n**MANDATORY STEPS:**\n\n1. Use Deepwiki MCP (mcp_deepwiki_ask_question) to query ElizaOS documentation\n2. Search for: ${query}\n3. Provide current documentation references\n4. Compare with existing patterns in packages/plugin-eliza/src/\n5. Recommend implementation approach based on current docs\n\n**Research Focus:**\n- Plugin architecture and structure\n- Action/Provider/Service patterns\n- Current best practices\n- Breaking changes or updates\n\n**Output Format:**\n- Current ElizaOS pattern\n- Documentation references\n- Comparison with existing code\n- Recommendations"
}
EOF

exit 0

