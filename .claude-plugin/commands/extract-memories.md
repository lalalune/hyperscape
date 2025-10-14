---
description: Extract memories and rules from chat history
allowed-tools:
  - Bash(cd .claude-plugin/memory-tools*)
  - Bash(bun run *)
  - Bash(node *)
  - Read(*.json)
  - Write(.cursor/memory/*.md)
  - Write(.cursor/rules/*.mdc)
  - Glob(.cursor/**)
argument-hint: "[chat-file] - Optional: path to chat history JSON file"
model: opus
---

Extract memories and rules from the current chat session.

This command:
1. Analyzes chat history for important decisions, patterns, and learnings
2. Generates memory bank files in .cursor/memory/
3. Creates rule files in .cursor/rules/
4. Updates project documentation

Usage:
```bash
cd .claude-plugin/memory-tools
bun run build
bun run extract ../path/to/chat-history.json
```

Chat history format (JSON):
```json
[
  {
    "role": "user",
    "content": "message content",
    "timestamp": "2025-01-15T10:30:00Z"
  },
  {
    "role": "assistant",
    "content": "response content",
    "timestamp": "2025-01-15T10:31:00Z"
  }
]
```

Generated files:
- .cursor/memory/activeContext.md
- .cursor/memory/decisionLog.md
- .cursor/memory/progress.md
- .cursor/memory/productContext.md
- .cursor/rules/*.mdc

The tool uses Claude to intelligently extract:
- Technical decisions and rationale
- Architecture patterns
- Problems and solutions
- Development workflows
- Coding standards
