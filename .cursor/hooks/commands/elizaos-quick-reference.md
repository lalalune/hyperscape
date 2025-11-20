# ElizaOS Quick Reference

Quick reference for common ElizaOS patterns and Deepwiki MCP queries.

## Common Deepwiki Queries

### Plugin Architecture
```
Query: "ElizaOS plugin architecture structure"
Query: "How to create an ElizaOS plugin"
Query: "Plugin interface structure"
```

### Actions
```
Query: "ElizaOS Action interface structure"
Query: "How to implement actions in ElizaOS plugins"
Query: "Action validation and handler patterns"
Query: "Action examples array format"
```

### Providers
```
Query: "ElizaOS Provider interface structure"
Query: "How to implement providers in ElizaOS plugins"
Query: "Provider dynamic flag usage"
Query: "Provider position ordering"
```

### Services
```
Query: "ElizaOS Service lifecycle"
Query: "How to implement services in ElizaOS plugins"
Query: "Service initialization patterns"
Query: "Service cleanup and stop methods"
```

### Events
```
Query: "ElizaOS event handling patterns"
Query: "How to register event handlers"
Query: "Event types in ElizaOS"
```

### Configuration
```
Query: "ElizaOS plugin configuration patterns"
Query: "Zod schema validation in plugins"
Query: "Environment variable handling"
```

## Quick Validation Queries

For validating specific components:

### Validate Action
```
1. Query: "ElizaOS Action interface current structure"
2. Compare with your action implementation
3. Check: name, similes, description, validate, handler, examples
```

### Validate Provider
```
1. Query: "ElizaOS Provider interface current structure"
2. Compare with your provider implementation
3. Check: name, description, dynamic, position, get method
```

### Validate Service
```
1. Query: "ElizaOS Service lifecycle current patterns"
2. Compare with your service implementation
3. Check: initialize, start, stop, cleanup methods
```

## Using Commands

### Research Command
```
/elizaos-research <your question>
```

Examples:
- `/elizaos-research How do I create a new action?`
- `/elizaos-research Provider interface structure`
- `/elizaos-research Service lifecycle patterns`

### Validate Command
```
/elizaos-validate <file or component>
```

Examples:
- `/elizaos-validate packages/plugin-eliza/src/actions/movement.ts`
- `/elizaos-validate action implementation`
- `/elizaos-validate provider patterns`

## Integration with Rules

These commands work with the plugin rules in `.cursor/rules/plugin-eliza-*.mdc`:

- **Research** → Check rules → Implement
- **Implement** → **Validate** → Fix issues → Commit

## Best Practices

1. **Always research first** before implementing new features
2. **Validate after changes** to ensure compliance 
3. **Use Deepwiki MCP** for current documentation (not training data)
4. **Compare** with existing code patterns
5. **Reference** specific documentation URLs

