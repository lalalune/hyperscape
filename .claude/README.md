# Hyperscape AI Assistant Configuration

This project uses AI assistant configuration from a Claude Code plugin.

## Automatic Setup

When you first use Claude Code in this project, you'll be prompted to:

1. **Trust the marketplace**: Approve the `hyperscape-ai` marketplace
2. **Install the plugin**: The `hyperscape-ai-assistant` plugin will auto-install

This is configured in `.claude/settings.json`.

## Manual Installation

If automatic installation doesn't work, you can manually install:

```bash
# Add the marketplace
/plugin marketplace add HyperscapeAI/claude

# Install the plugin
/plugin install hyperscape-ai-assistant@hyperscape-ai
```

## What's Included

Once installed, you'll have access to:

### Commands
- `/reset-and-dev` - Reset environment and restart development servers

### Skills
- `run-drizzle-kit` - Safely run Drizzle ORM database commands
- `local-database-usage` - Best practices for local database development
- `hyperscape-jwt-testing` - JWT authentication testing workflows

### Hooks
- **Pre-tool validation** - Blocks destructive bash commands, enforces research-first protocol
- **Post-tool context** - Provides insights after file operations
- **Session lifecycle** - Initializes project context on session start

### Documentation
Comprehensive reference documentation for:
- ElizaOS integration patterns
- Testing and validation workflows
- TypeScript strong typing rules
- Architecture and performance guidelines

## Updating the Plugin

To get the latest version:

```bash
/plugin update hyperscape-ai-assistant
```

## Troubleshooting

### Plugin Not Installing

1. Check Claude Code version: `/help` (requires v2.0+)
2. Verify marketplace: `/plugin marketplace list`
3. Try manual installation (see above)

### Hooks Not Working

1. Ensure Bun is installed: `bun --version` (requires v1.1.38+)
2. Check hook scripts are executable
3. Review logs in `.claude/logs/`

### Need Help?

- **Plugin source**: https://github.com/HyperscapeAI/claude
- **Issues**: https://github.com/HyperscapeAI/claude/issues
- **Hyperscape discussions**: https://github.com/HyperscapeAI/hyperscape/discussions

## For Cursor Users

This configuration is for Claude Code CLI. If you're using Cursor IDE:

1. Clone the configuration repository:
   ```bash
   git clone https://github.com/HyperscapeAI/claude.git .claude-config
   ```

2. Copy the `.cursor` directory:
   ```bash
   cp -r .claude-config/.cursor .cursor
   ```

Note: `.cursor/` is gitignored, so your local copy won't be committed.

## Configuration Details

The `settings.json` file in this directory configures:

- `extraKnownMarketplaces`: Adds the Hyperscape AI marketplace
- `autoInstallPlugins`: Automatically installs the assistant plugin

You can modify `settings.json` to customize which plugins auto-install.

## Do Not Commit

This `.claude/` directory is gitignored except for:
- `settings.json` - Shared marketplace configuration
- `README.md` - This file

All other files in `.claude/` are local to your machine (logs, cache, etc.).
