#!/bin/bash

# eliza-docs-hook.sh - Hook that uses Eliza documentation index
# Runs before prompt submission and file edits to suggest relevant docs

# Read JSON input from stdin
input=$(cat)

# Parse file path or prompt
file_path=$(echo "$input" | jq -r '.file_path // ""' 2>/dev/null || echo "")
prompt=$(echo "$input" | jq -r '.prompt // ""' 2>/dev/null || echo "")

# Only check plugin-eliza files
if [ -n "$file_path" ] && [[ ! "$file_path" =~ packages/plugin-eliza ]]; then
  exit 0
fi

# Use doc-visitor tool to get relevant docs from Eliza documentation index
DOC_VISITOR="/Users/home/hyperscape/.cursor/tools/doc-visitor.sh"
DOCS_INDEX="/Users/home/hyperscape/.cursor/memory/elizaos-docs-index.md"

if [ ! -f "$DOC_VISITOR" ] || [ ! -f "$DOCS_INDEX" ]; then
  exit 0
fi

# Get relevant documentation pages
if [ -n "$file_path" ]; then
  result=$(echo "{\"file_path\": \"$file_path\"}" | "$DOC_VISITOR" 2>/dev/null)
elif [ -n "$prompt" ]; then
  result=$(echo "{\"prompt\": \"$prompt\"}" | "$DOC_VISITOR" 2>/dev/null)
else
  exit 0
fi

# If tool returned docs, output them with clear formatting
if [ -n "$result" ] && echo "$result" | grep -q "docs.elizaos.ai"; then
  echo ""
  echo "📚 ElizaOS Documentation Suggestions:"
  echo "======================================"
  echo "$result"
  echo ""
  echo "💡 Tip: Visit these pages before implementing to ensure you follow current ElizaOS patterns."
  echo ""
else
  exit 0
fi

exit 0

