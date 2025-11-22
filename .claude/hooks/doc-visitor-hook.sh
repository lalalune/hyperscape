#!/bin/bash

# doc-visitor-hook.sh - Hook that ensures agent visits relevant docs
# Runs before file edits and prompt submission

# Read JSON input from stdin
input=$(cat)

# Parse file path or prompt
file_path=$(echo "$input" | jq -r '.file_path // ""' 2>/dev/null || echo "")
prompt=$(echo "$input" | jq -r '.prompt // ""' 2>/dev/null || echo "")

# Only check plugin-eliza files
if [ -n "$file_path" ] && [[ ! "$file_path" =~ packages/plugin-eliza ]]; then
  exit 0
fi

# Use doc-visitor tool to get relevant docs
if [ -n "$file_path" ]; then
  result=$(echo "{\"file_path\": \"$file_path\"}" | /Users/home/hyperscape/.cursor/tools/doc-visitor.sh 2>/dev/null)
elif [ -n "$prompt" ]; then
  result=$(echo "{\"prompt\": \"$prompt\"}" | /Users/home/hyperscape/.cursor/tools/doc-visitor.sh 2>/dev/null)
else
  exit 0
fi

# If tool returned docs, output them
if [ -n "$result" ] && echo "$result" | grep -q "docs.elizaos.ai"; then
  echo "$result"
else
  exit 0
fi

exit 0

