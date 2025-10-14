# Installation Guide - Hyperscape Development Plugin

This guide walks you through installing and configuring the Hyperscape Development Plugin for Claude Code.

## Prerequisites

Before installing, ensure you have:

- **Node.js** ≥ 20.0.0
- **Bun** ≥ 1.0.0
- **TypeScript** ≥ 5.9.0
- **Claude Code** ≥ 2.0.0
- **Git** (for cloning repository)

## Step-by-Step Installation

### 1. Clone or Navigate to Hyperscape Repository

```bash
cd /path/to/hyperscape
```

### 2. Install MCP Server Dependencies

```bash
cd .claude-plugin/mcp
npm install
npm run build
```

This compiles the MCP server that provides development tools.

### 3. Install Memory Tools Dependencies

```bash
cd ../memory-tools
npm install
npm run build
```

This compiles the chat memory extraction tool.

### 4. Set Environment Variables

Add these to your `.env` file in the project root:

```bash
# Required
HYPERSCAPE_PROJECT_ROOT=/absolute/path/to/hyperscape

# Required for memory extraction
ANTHROPIC_API_KEY=your-anthropic-api-key

# Optional (for certain features)
OPENAI_API_KEY=your-openai-api-key
```

Or add to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
export HYPERSCAPE_PROJECT_ROOT="/absolute/path/to/hyperscape"
export ANTHROPIC_API_KEY="your-anthropic-api-key"
```

### 5. Configure MCP Server in Claude Code

Add the MCP server to Claude Code's configuration:

```bash
claude mcp add --transport stdio hyperscape-dev \
  node $HYPERSCAPE_PROJECT_ROOT/.claude-plugin/mcp/dist/server.js
```

Or manually edit `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "hyperscape-dev": {
      "transport": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/hyperscape/.claude-plugin/mcp/dist/server.js"],
      "env": {
        "HYPERSCAPE_PROJECT_ROOT": "/absolute/path/to/hyperscape",
        "ANTHROPIC_API_KEY": "your-api-key"
      }
    }
  }
}
```

### 6. Install Plugin Commands

Copy plugin commands to Claude Code:

```bash
# Copy to project-level commands
mkdir -p .claude/commands
cp .claude-plugin/commands/* .claude/commands/

# Or copy to user-level commands (available in all projects)
mkdir -p ~/.claude/commands
cp .claude-plugin/commands/* ~/.claude/commands/
```

### 7. Configure Hooks (Optional)

To enable automatic code quality checks, configure hooks in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude-plugin/hooks/validate-write.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash.*test",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude-plugin/hooks/post-test.sh"
          }
        ]
      }
    ]
  }
}
```

### 8. Make Hook Scripts Executable

```bash
chmod +x .claude-plugin/hooks/*.sh
```

## Verification

Test that everything is installed correctly:

### Test MCP Server

```bash
# In Claude Code chat
Use the hyperscape_validate_types tool to check packages/plugin-hyperscape/src
```

### Test Slash Commands

```bash
# In Claude Code chat
/check-types
```

Expected output: Type validation results for the codebase

### Test Memory Extraction

Create a test chat history file:

```bash
cat > test-chat.json << 'EOF'
[
  {
    "role": "user",
    "content": "Help me implement a new action",
    "timestamp": "2025-01-15T10:00:00Z"
  },
  {
    "role": "assistant",
    "content": "I'll help you create a new action following ElizaOS patterns",
    "timestamp": "2025-01-15T10:01:00Z"
  }
]
EOF
```

Run extraction:

```bash
cd .claude-plugin/memory-tools
node dist/chat-memory-extractor.js ../../test-chat.json
```

Expected output: Generated memory bank files in `.cursor/memory/`

## Troubleshooting

### MCP Server Not Found

**Problem:** Claude Code can't find the MCP server

**Solution:**
1. Verify the path in `mcp.json` is absolute
2. Check that `npm run build` completed successfully
3. Test running the server manually:
   ```bash
   node .claude-plugin/mcp/dist/server.js
   ```

### Commands Not Available

**Problem:** Slash commands don't appear

**Solution:**
1. Ensure commands are in `.claude/commands/` or `~/.claude/commands/`
2. Restart Claude Code
3. Check command file format (should be `.md` files)

### Type Validation Fails

**Problem:** Hook scripts report permission errors

**Solution:**
```bash
chmod +x .claude-plugin/hooks/*.sh
```

### Environment Variables Not Set

**Problem:** Tools report missing API keys or project root

**Solution:**
1. Add variables to `.env` in project root
2. Or add to shell profile and restart terminal
3. Verify with:
   ```bash
   echo $HYPERSCAPE_PROJECT_ROOT
   echo $ANTHROPIC_API_KEY
   ```

## Updating the Plugin

To update to the latest version:

```bash
# Pull latest changes
git pull origin main

# Rebuild MCP server
cd .claude-plugin/mcp
npm install
npm run build

# Rebuild memory tools
cd ../memory-tools
npm install
npm run build

# Update commands
cp .claude-plugin/commands/* .claude/commands/
```

## Uninstalling

To remove the plugin:

```bash
# Remove MCP server
claude mcp remove hyperscape-dev

# Remove commands
rm -rf .claude/commands/test-rpg.md
rm -rf .claude/commands/test-visual.md
# ... (remove other command files)

# Remove plugin directory (optional)
rm -rf .claude-plugin
```

## Next Steps

Once installed, see:
- [USAGE.md](USAGE.md) - How to use the plugin
- [README.md](README.md) - Full feature documentation
- [CLAUDE.md](../CLAUDE.md) - Project rules and standards

## Support

For help:
- GitHub Issues: https://github.com/HyperscapeAI/hyperscape/issues
- Documentation: See README.md and USAGE.md
