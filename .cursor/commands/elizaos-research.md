# ElizaOS Research Command

Use Deepwiki MCP to research ElizaOS documentation before implementing features.

## Usage

Type `/elizaos-research` followed by your research question or topic.

## Examples

```
/elizaos-research How do I create a new action in ElizaOS?
/elizaos-research What is the Provider interface structure?
/elizaos-research How do services work in ElizaOS plugins?
/elizaos-research What are the requirements for plugin initialization?
```

## What This Command Does

1. Uses Deepwiki MCP to query ElizaOS documentation
2. Searches for relevant patterns and examples
3. Provides current documentation references
4. Ensures you're using up-to-date ElizaOS patterns

## When to Use

- Before implementing new actions
- Before creating providers
- Before adding services or managers
- When unsure about ElizaOS patterns
- When documentation might be outdated

## Agent Instructions

When this command is invoked, you MUST:

1. **Use Deepwiki MCP** to query ElizaOS documentation
2. **Search for** the specific topic or pattern mentioned
3. **Provide** current documentation references
4. **Compare** with existing code patterns in `packages/plugin-eliza/src/`
5. **Recommend** implementation approach based on current docs

## Research Topics

Common research areas:
- Plugin architecture and structure
- Action implementation patterns
- Provider implementation patterns
- Service lifecycle and initialization
- Event handling
- Memory storage
- Configuration patterns

