# ElizaOS Validation Command

Validate plugin code against current ElizaOS patterns and documentation.

## Usage

Type `/elizaos-validate` followed by a file path or component name.

## Examples

```
/elizaos-validate packages/plugin-eliza/src/actions/movement.ts
/elizaos-validate action implementation
/elizaos-validate provider patterns
/elizaos-validate service initialization
```

## What This Command Does

1. Reads the specified file or searches for the component
2. Uses Deepwiki MCP to get current ElizaOS patterns
3. Compares implementation against current documentation
4. Identifies deviations or outdated patterns
5. Provides recommendations for alignment

## When to Use

- After implementing new features
- Before committing changes
- When reviewing code
- When patterns seem outdated
- Before major refactoring

## Agent Instructions

When this command is invoked, you MUST:

1. **Read** the specified file(s) or search for the component
2. **Use Deepwiki MCP** to get current ElizaOS documentation
3. **Compare** implementation with current patterns:
   - Action interface structure
   - Provider interface structure
   - Service lifecycle patterns
   - Event handling patterns
   - Configuration patterns
4. **Identify** any deviations or outdated patterns
5. **Provide** specific recommendations:
   - What needs to change
   - Why it needs to change
   - How to fix it
   - Reference to current documentation

## Validation Checklist

- ✅ Action follows current Action interface
- ✅ Provider follows current Provider interface
- ✅ Service follows current Service lifecycle
- ✅ Event handlers follow current patterns
- ✅ Configuration uses current schema patterns
- ✅ Types match current ElizaOS types
- ✅ Examples array present in actions
- ✅ Dynamic flag set in providers
- ✅ Error handling follows current patterns

## Output Format

For each validation, provide:

1. **Status**: ✅ Compliant | ⚠️ Needs Updates | ❌ Non-Compliant
2. **Issues Found**: List of specific issues
3. **Current Pattern**: What the current ElizaOS pattern is
4. **Recommendations**: How to fix issues
5. **Documentation Reference**: Link to relevant docs

