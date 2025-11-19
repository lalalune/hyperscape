# Cursor Custom Commands

Custom commands for ElizaOS research and validation using Deepwiki MCP.

## Available Commands

### `/elizaos-research`

Research ElizaOS documentation using Deepwiki MCP.

**Usage:**
```
/elizaos-research <topic or question>
```

**Examples:**
- `/elizaos-research How do I create a new action?`
- `/elizaos-research Provider interface structure`
- `/elizaos-research Service lifecycle patterns`

**What it does:**
- Queries ElizaOS documentation via Deepwiki MCP
- Provides current patterns and examples
- Ensures you're using up-to-date documentation

### `/elizaos-validate`

Validate plugin code against current ElizaOS patterns.

**Usage:**
```
/elizaos-validate <file path or component>
```

**Examples:**
- `/elizaos-validate packages/plugin-eliza/src/actions/movement.ts`
- `/elizaos-validate action implementation`
- `/elizaos-validate provider patterns`

**What it does:**
- Reads specified files or searches for components
- Compares against current ElizaOS documentation
- Identifies deviations and provides fixes

## How Commands Work

These commands are implemented as markdown files in `.cursor/commands/`. When you type the command in Cursor chat, the agent will:

1. Recognize the command prefix (`/elizaos-research` or `/elizaos-validate`)
2. Read the command file for instructions
3. Execute the appropriate actions:
   - For research: Use Deepwiki MCP to query ElizaOS docs
   - For validation: Read files, query docs, compare patterns

## Integration with Hooks

These commands complement the existing hooks:
- **Hooks** run automatically (before prompts, after edits)
- **Commands** run on-demand (when you explicitly invoke them)

Use commands when you want to:
- Research before starting work
- Validate after making changes
- Check specific patterns or files

## Adding New Commands

To add a new command:

1. Create a markdown file in `.cursor/commands/`
2. Name it descriptively (e.g., `my-command.md`)
3. Include:
   - Command name and usage
   - Examples
   - What it does
   - When to use it
   - Agent instructions

The agent will automatically recognize commands prefixed with `/` in chat.

